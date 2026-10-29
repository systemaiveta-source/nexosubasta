ALTER TABLE public.auction_private ADD COLUMN service_budget numeric CHECK (service_budget IS NULL OR service_budget>0);
ALTER TABLE public.auctions ADD COLUMN selection_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.bids ADD COLUMN conditions text NOT NULL DEFAULT '';
ALTER TABLE public.transactions ADD COLUMN payment_stage text NOT NULL DEFAULT 'coordination' CHECK(payment_stage IN ('coordination','payment_pending','receipt_sent','payment_confirmed','delivery_pending','completion_pending'));
ALTER TABLE public.transactions ADD COLUMN buyer_confirmed_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN seller_confirmed_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN agreed_method text;
ALTER TABLE public.messages ADD COLUMN attachment_path text;
ALTER TABLE public.messages ADD COLUMN submission_key uuid;
CREATE UNIQUE INDEX messages_submission_once ON public.messages(sender_id,submission_key) WHERE submission_key IS NOT NULL;
CREATE TABLE public.operation_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),transaction_id uuid NOT NULL REFERENCES public.transactions(id),actor_id uuid NOT NULL,kind text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.operation_events TO authenticated;
GRANT ALL ON public.operation_events TO service_role;
ALTER TABLE public.operation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY operation_events_read ON public.operation_events FOR SELECT TO authenticated USING(public.is_tx_party(transaction_id,auth.uid()) OR public.has_role(auth.uid(),'admin'));
REVOKE SELECT ON public.auctions FROM anon,authenticated;
GRANT SELECT(id,seller_id,title,description,category_id,country,city,scope,delivery_terms,images,min_increment,currency,status,duration_hours,starts_at,ends_at,original_ends_at,current_price,bid_count,leader_id,winner_id,has_reserve,reserve_met,extensions_count,flagged,created_at,updated_at,auction_type,service_from,service_to,duration_minutes,selection_pending) ON public.auctions TO anon,authenticated;
CREATE VIEW public.auctions_safe WITH (security_barrier=true) AS SELECT a.id,a.seller_id,a.title,a.description,a.category_id,a.country,a.city,a.scope,a.delivery_terms,a.images,CASE WHEN a.auction_type='item' THEN a.starting_price ELSE NULL END AS starting_price,a.min_increment,a.currency,a.status,a.duration_hours,a.starts_at,a.ends_at,a.original_ends_at,a.current_price,a.bid_count,a.leader_id,a.winner_id,a.has_reserve,a.reserve_met,a.extensions_count,a.flagged,a.created_at,a.updated_at,a.auction_type,a.service_from,a.service_to,a.duration_minutes,a.selection_pending FROM public.auctions a WHERE a.status<>'draft' OR a.seller_id=auth.uid() OR public.is_staff(auth.uid());
GRANT SELECT ON public.auctions_safe TO anon,authenticated,service_role;
COMMENT ON VIEW public.auctions_safe IS 'Public auction projection: service budgets/legacy service starting prices are never returned; draft visibility explicitly scopes to owner/staff.';
ALTER POLICY "bids public" ON public.bids TO authenticated USING(bidder_id=auth.uid() OR EXISTS(SELECT 1 FROM public.auctions a WHERE a.id=bids.auction_id AND a.seller_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
REVOKE SELECT ON public.bids FROM anon;
GRANT SELECT(conditions) ON public.bids TO authenticated;
CREATE POLICY operation_documents_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='operation-documents' AND split_part(name,'/',2)=auth.uid()::text AND EXISTS(SELECT 1 FROM public.transactions t WHERE t.id::text=split_part(name,'/',1) AND (t.buyer_id=auth.uid() OR t.seller_id=auth.uid()) AND t.status='pending'));
CREATE POLICY operation_documents_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='operation-documents' AND EXISTS(SELECT 1 FROM public.transactions t WHERE t.id::text=split_part(name,'/',1) AND (t.buyer_id=auth.uid() OR t.seller_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE OR REPLACE FUNCTION public.choose_service_provider(_auction uuid,_bid uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; b public.bids; tx_id uuid;
BEGIN
 SELECT * INTO a FROM public.auctions WHERE id=_auction FOR UPDATE;
 IF auth.uid() IS NULL OR a.id IS NULL OR a.seller_id<>auth.uid() OR a.auction_type<>'service' THEN RAISE EXCEPTION 'Solicitud no disponible'; END IF;
 IF a.status='ended_sold' THEN SELECT id INTO tx_id FROM public.transactions WHERE auction_id=a.id AND seller_id=(SELECT bidder_id FROM public.bids WHERE id=_bid AND auction_id=a.id); IF tx_id IS NULL THEN RAISE EXCEPTION 'Ya elegiste un proveedor'; END IF; RETURN tx_id; END IF;
 IF a.status NOT IN ('active','ended_unsold') OR (a.status='ended_unsold' AND NOT a.selection_pending) THEN RAISE EXCEPTION 'No se puede elegir un proveedor'; END IF;
 IF NOT public.has_active_seller_sub(auth.uid()) THEN RAISE EXCEPTION 'Necesitas membresía activa'; END IF;
 SELECT * INTO b FROM public.bids WHERE id=_bid AND auction_id=a.id;
 IF b.id IS NULL OR NOT public.has_active_seller_sub(b.bidder_id) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=b.bidder_id AND account_status='active') THEN RAISE EXCEPTION 'Proveedor no disponible'; END IF;
 PERFORM set_config('nexo.engine','on',true);
 UPDATE public.auctions SET status='ended_sold',winner_id=b.bidder_id,selection_pending=false WHERE id=a.id;
 PERFORM set_config('nexo.engine','off',true);
 INSERT INTO public.transactions(auction_id,buyer_id,seller_id,amount,currency) VALUES(a.id,a.seller_id,b.bidder_id,b.amount,a.currency) RETURNING id INTO tx_id;
 INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'provider_selected',jsonb_build_object('bid_id',b.id,'transaction_id',tx_id));
 PERFORM public.notify(a.seller_id,'Proveedor elegido','La operación está lista para coordinar.','/operaciones/'||tx_id);
 PERFORM public.notify(b.bidder_id,'Tu oferta fue elegida','Coordina el servicio con el cliente.','/operaciones/'||tx_id);
 RETURN tx_id;
END $$;
REVOKE ALL ON FUNCTION public.choose_service_provider(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.choose_service_provider(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.confirm_transaction(_tx uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.transactions;
BEGIN
 SELECT * INTO t FROM public.transactions WHERE id=_tx FOR UPDATE;
 IF auth.uid() IS NULL OR t.id IS NULL OR NOT(t.buyer_id=auth.uid() OR t.seller_id=auth.uid()) THEN RAISE EXCEPTION 'Operación no disponible'; END IF;
 IF t.status='completed' THEN RETURN; END IF;
 IF t.status<>'pending' OR EXISTS(SELECT 1 FROM public.disputes d WHERE d.transaction_id=t.id AND d.status='open') THEN RAISE EXCEPTION 'No se puede completar una operación en disputa'; END IF;
 IF (auth.uid()=t.buyer_id AND t.buyer_confirmed) OR (auth.uid()=t.seller_id AND t.seller_confirmed) THEN RETURN; END IF;
 UPDATE public.transactions SET buyer_confirmed=buyer_confirmed OR auth.uid()=t.buyer_id,seller_confirmed=seller_confirmed OR auth.uid()=t.seller_id,buyer_confirmed_at=CASE WHEN auth.uid()=t.buyer_id THEN now() ELSE buyer_confirmed_at END,seller_confirmed_at=CASE WHEN auth.uid()=t.seller_id THEN now() ELSE seller_confirmed_at END,payment_stage='completion_pending' WHERE id=t.id RETURNING * INTO t;
 IF t.buyer_confirmed AND t.seller_confirmed THEN UPDATE public.transactions SET status='completed',completed_at=now() WHERE id=t.id; END IF;
 INSERT INTO public.operation_events(transaction_id,actor_id,kind) VALUES(t.id,auth.uid(),'completion_confirmed');
 PERFORM public.notify(CASE WHEN auth.uid()=t.buyer_id THEN t.seller_id ELSE t.buyer_id END,'Confirmación de finalización','La otra parte marcó la operación como completada.','/operaciones/'||t.id);
END $$;
CREATE OR REPLACE FUNCTION public.advance_operation(_tx uuid,_stage text,_method text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.transactions;
BEGIN
 SELECT * INTO t FROM public.transactions WHERE id=_tx FOR UPDATE;
 IF auth.uid() IS NULL OR t.id IS NULL OR NOT(t.buyer_id=auth.uid() OR t.seller_id=auth.uid()) OR t.status<>'pending' THEN RAISE EXCEPTION 'Operación no disponible'; END IF;
 IF EXISTS(SELECT 1 FROM public.disputes d WHERE d.transaction_id=t.id AND d.status='open') THEN RAISE EXCEPTION 'Operación en disputa'; END IF;
 IF NOT ((t.payment_stage='coordination' AND _stage='payment_pending' AND length(trim(_method)) BETWEEN 2 AND 200) OR (t.payment_stage='payment_pending' AND _stage='receipt_sent' AND auth.uid()=t.buyer_id AND EXISTS(SELECT 1 FROM public.messages m WHERE m.transaction_id=t.id AND m.sender_id=auth.uid() AND m.attachment_path IS NOT NULL)) OR (t.payment_stage IN ('payment_pending','receipt_sent') AND _stage='payment_confirmed' AND auth.uid()=t.seller_id) OR (t.payment_stage='payment_confirmed' AND _stage='delivery_pending') OR (t.payment_stage='delivery_pending' AND _stage='completion_pending')) THEN RAISE EXCEPTION 'Transición no permitida'; END IF;
 UPDATE public.transactions SET payment_stage=_stage,agreed_method=CASE WHEN _stage='payment_pending' THEN trim(_method) ELSE agreed_method END WHERE id=t.id;
 INSERT INTO public.operation_events(transaction_id,actor_id,kind,details) VALUES(t.id,auth.uid(),'stage_changed',jsonb_build_object('stage',_stage));
 PERFORM public.notify(CASE WHEN auth.uid()=t.buyer_id THEN t.seller_id ELSE t.buyer_id END,'Operación actualizada','Hay un cambio de estado en tu operación.','/operaciones/'||t.id);
END $$;
REVOKE ALL ON FUNCTION public.advance_operation(uuid,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.advance_operation(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.send_operation_message(_tx uuid,_body text,_key uuid,_attachment text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.transactions; message_id uuid;
BEGIN
 SELECT * INTO t FROM public.transactions WHERE id=_tx FOR UPDATE;
 IF auth.uid() IS NULL OR t.id IS NULL OR NOT(t.buyer_id=auth.uid() OR t.seller_id=auth.uid()) OR t.status='cancelled' THEN RAISE EXCEPTION 'Operación no disponible'; END IF;
 IF length(trim(_body)) NOT BETWEEN 1 AND 2000 OR _key IS NULL THEN RAISE EXCEPTION 'Mensaje no válido'; END IF;
 SELECT id INTO message_id FROM public.messages WHERE sender_id=auth.uid() AND submission_key=_key; IF message_id IS NOT NULL THEN RETURN message_id; END IF;
 IF _attachment IS NOT NULL AND (split_part(_attachment,'/',1)<>t.id::text OR split_part(_attachment,'/',2)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='operation-documents' AND o.name=_attachment)) THEN RAISE EXCEPTION 'Adjunto no válido'; END IF;
 INSERT INTO public.messages(transaction_id,sender_id,body,submission_key,attachment_path) VALUES(t.id,auth.uid(),trim(_body),_key,_attachment) RETURNING id INTO message_id;
 PERFORM public.notify(CASE WHEN auth.uid()=t.buyer_id THEN t.seller_id ELSE t.buyer_id END,'Nuevo mensaje','Tienes un mensaje privado en una operación.','/operaciones/'||t.id);
 RETURN message_id;
END $$;
REVOKE INSERT ON public.messages FROM authenticated;
REVOKE ALL ON FUNCTION public.send_operation_message(uuid,text,uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.send_operation_message(uuid,text,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.service_budget_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.auction_type='service' AND TG_OP='INSERT' THEN NEW.starting_price:=1; END IF; RETURN NEW; END $$;
CREATE TRIGGER service_budget_guard BEFORE INSERT ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.service_budget_guard();