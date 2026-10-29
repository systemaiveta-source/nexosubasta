CREATE OR REPLACE FUNCTION public.place_bid(_auction_id uuid,_amount numeric,_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; existing public.bids; b public.bids; reserve_value numeric; limit_value numeric; ts timestamptz; new_end timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para ofertar'; END IF;
 IF _idempotency_key IS NULL OR length(_idempotency_key) NOT BETWEEN 8 AND 100 THEN RAISE EXCEPTION 'Solicitud inválida'; END IF;
 IF _amount IS NULL OR _amount<=0 OR _amount>1000000000 OR _amount<>round(_amount,2) THEN RAISE EXCEPTION 'Importe no válido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||_idempotency_key,0));
 SELECT * INTO existing FROM public.bids WHERE bidder_id=auth.uid() AND idempotency_key=_idempotency_key;
 IF existing.id IS NOT NULL THEN IF existing.auction_id<>_auction_id OR existing.amount<>_amount THEN RAISE EXCEPTION 'La solicitud ya se usó para otra oferta'; END IF; RETURN jsonb_build_object('ok',true,'duplicate',true,'bid_id',existing.id); END IF;
 SELECT * INTO a FROM public.auctions WHERE id=_auction_id FOR UPDATE; ts:=clock_timestamp();
 IF a.id IS NULL OR a.status<>'active' OR ts<a.starts_at OR ts>=a.ends_at THEN RAISE EXCEPTION 'La subasta no está activa o ha cerrado'; END IF;
 IF a.seller_id=auth.uid() THEN RAISE EXCEPTION 'No puedes ofertar en tu propia subasta'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
 IF a.leader_id=auth.uid() THEN RAISE EXCEPTION 'Ya tienes la oferta líder'; END IF;
 IF a.auction_type='service' THEN
  IF NOT public.has_active_seller_sub(auth.uid()) THEN RAISE EXCEPTION 'Necesitas una membresía activa para ofrecer servicios'; END IF;
  limit_value:=a.current_price-a.min_increment;
  IF limit_value IS NOT NULL AND _amount>limit_value THEN RAISE EXCEPTION 'Tu oferta debe ser % o menos',limit_value; END IF;
 ELSE
  limit_value:=CASE WHEN a.current_price IS NULL THEN a.starting_price ELSE a.current_price+a.min_increment END;
  IF _amount<limit_value THEN RAISE EXCEPTION 'La oferta mínima es %',limit_value; END IF;
 END IF;
 INSERT INTO public.bids(auction_id,bidder_id,amount,idempotency_key,created_at) VALUES(a.id,auth.uid(),_amount,_idempotency_key,ts) RETURNING * INTO b;
 SELECT reserve_price INTO reserve_value FROM public.auction_private WHERE auction_id=a.id;
 new_end:=a.ends_at;
 IF a.ends_at-ts<=interval '60 seconds' THEN new_end:=a.ends_at+interval '60 seconds'; INSERT INTO public.auction_extensions(auction_id,bid_id,old_ends_at,new_ends_at,reason) VALUES(a.id,b.id,a.ends_at,new_end,'Oferta válida en los últimos 60 segundos'); END IF;
 PERFORM set_config('nexo.engine','on',true);
 UPDATE public.auctions SET current_price=b.amount,bid_count=bid_count+1,leader_id=auth.uid(),reserve_met=CASE WHEN a.auction_type='item' THEN reserve_value IS NULL OR b.amount>=reserve_value ELSE false END,ends_at=new_end,extensions_count=extensions_count+CASE WHEN new_end<>a.ends_at THEN 1 ELSE 0 END WHERE id=a.id;
 PERFORM set_config('nexo.engine','off',true);
 INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'bid',jsonb_build_object('bid_id',b.id,'amount',b.amount,'extended',new_end<>a.ends_at));
 IF a.leader_id IS NOT NULL THEN PERFORM public.notify(a.leader_id,'Te han superado','Hay una nueva oferta líder.','/subastas/'||a.id); END IF;
 PERFORM public.notify(auth.uid(),'Oferta aceptada','Tu oferta fue registrada.','/subastas/'||a.id);
 RETURN jsonb_build_object('ok',true,'bid_id',b.id,'ends_at',new_end,'extended',new_end<>a.ends_at);
END $$;
CREATE OR REPLACE FUNCTION public.process_auctions() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; n int:=0; reserve_value numeric; sold boolean; tx_id uuid;
BEGIN
 PERFORM set_config('nexo.engine','on',true);
 UPDATE public.auctions SET status='active' WHERE status='scheduled' AND starts_at<=clock_timestamp();
 FOR a IN SELECT * FROM public.auctions WHERE status='active' AND ends_at<=clock_timestamp() FOR UPDATE SKIP LOCKED LOOP
  IF a.auction_type='service' THEN
   UPDATE public.auctions SET status='ended_unsold',winner_id=null,selection_pending=(a.bid_count>0) WHERE id=a.id;
   INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'service_closed',jsonb_build_object('offers',a.bid_count));
   PERFORM public.notify(a.seller_id,'Solicitud de servicio finalizada','Revisa las ofertas y elige al proveedor.','/subastas/'||a.id);
   n:=n+1; CONTINUE;
  END IF;
  SELECT reserve_price INTO reserve_value FROM public.auction_private WHERE auction_id=a.id;
  sold:=a.leader_id IS NOT NULL AND (reserve_value IS NULL OR a.current_price>=reserve_value);
  UPDATE public.auctions SET status=CASE WHEN sold THEN 'ended_sold' ELSE 'ended_unsold' END,winner_id=CASE WHEN sold THEN a.leader_id ELSE null END WHERE id=a.id AND status='active';
  INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'closed',jsonb_build_object('sold',sold,'amount',a.current_price));
  IF sold THEN
   INSERT INTO public.transactions(auction_id,buyer_id,seller_id,amount,currency) VALUES(a.id,a.leader_id,a.seller_id,a.current_price,a.currency) ON CONFLICT(auction_id) DO NOTHING RETURNING id INTO tx_id;
   IF tx_id IS NULL THEN SELECT id INTO tx_id FROM public.transactions WHERE auction_id=a.id; END IF;
   PERFORM public.notify(a.leader_id,'Subasta adjudicada','Coordina el pago y la entrega.','/operaciones/'||tx_id);
   PERFORM public.notify(a.seller_id,'Subasta adjudicada','Tu operación está lista.','/operaciones/'||tx_id);
  ELSE
   PERFORM public.notify(a.seller_id,'Subasta sin venta','La subasta finalizó sin adjudicación.','/subastas/'||a.id);
   IF a.leader_id IS NOT NULL THEN PERFORM public.notify(a.leader_id,'Subasta sin venta','La subasta finalizó sin adjudicación.','/subastas/'||a.id); END IF;
  END IF; n:=n+1;
 END LOOP;
 PERFORM set_config('nexo.engine','off',true); RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_auctions() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.service_bid_conditions(_auction uuid,_amount numeric,_key text,_conditions text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.auctions WHERE id=_auction AND auction_type='service') OR length(trim(_conditions)) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Indica experiencia, fecha y condiciones del servicio'; END IF;
 result:=public.place_bid(_auction,_amount,_key);
 IF coalesce((result->>'duplicate')::boolean,false)=false THEN UPDATE public.bids SET conditions=trim(_conditions) WHERE id=(result->>'bid_id')::uuid AND bidder_id=auth.uid(); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.service_bid_conditions(uuid,numeric,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.service_bid_conditions(uuid,numeric,text,text) TO authenticated;