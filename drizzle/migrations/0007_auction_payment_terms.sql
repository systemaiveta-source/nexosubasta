ALTER TABLE public.auctions ADD COLUMN accepted_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE public.auction_payment_acceptances(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auction_id uuid NOT NULL REFERENCES public.auctions(id),user_id uuid NOT NULL REFERENCES public.profiles(id),bid_id uuid NOT NULL UNIQUE REFERENCES public.bids(id),methods_snapshot jsonb NOT NULL,accepted_at timestamptz NOT NULL DEFAULT clock_timestamp());
GRANT SELECT ON public.auction_payment_acceptances TO authenticated;
GRANT ALL ON public.auction_payment_acceptances TO service_role;
ALTER TABLE public.auction_payment_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_acceptance_read ON public.auction_payment_acceptances FOR SELECT TO authenticated USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.auctions a WHERE a.id=auction_id AND a.seller_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.payment_terms_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE entry_value jsonb;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status<>'draft' AND NEW.accepted_payment_methods IS DISTINCT FROM OLD.accepted_payment_methods THEN RAISE EXCEPTION 'Las condiciones publicadas no pueden cambiar'; END IF;
 IF jsonb_typeof(NEW.accepted_payment_methods)<>'array' OR jsonb_array_length(NEW.accepted_payment_methods)>20 THEN RAISE EXCEPTION 'Métodos no válidos'; END IF;
 FOR entry_value IN SELECT r.value FROM jsonb_array_elements(NEW.accepted_payment_methods) r(value) LOOP
  IF length(trim(coalesce(entry_value->>'name',''))) NOT BETWEEN 2 AND 100 OR coalesce(entry_value->>'kind','') NOT IN ('bank','platform','wallet','crypto','other') THEN RAISE EXCEPTION 'Método no válido'; END IF;
  IF entry_value->>'kind'='crypto' AND (length(trim(coalesce(entry_value->>'asset','')))<2 OR length(trim(coalesce(entry_value->>'network','')))<2) THEN RAISE EXCEPTION 'Indica activo y red'; END IF;
 END LOOP; RETURN NEW;
END $$;
CREATE TRIGGER payment_terms_guard BEFORE INSERT OR UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.payment_terms_guard();
CREATE OR REPLACE FUNCTION public.bid_with_payment_acceptance(_auction uuid,_amount numeric,_key text,_accept boolean,_terms jsonb,_conditions text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; result jsonb;
BEGIN
 SELECT * INTO a FROM public.auctions WHERE id=_auction FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Subasta no disponible'; END IF;
 IF jsonb_array_length(a.accepted_payment_methods)>0 AND (_accept IS DISTINCT FROM true OR _terms IS DISTINCT FROM a.accepted_payment_methods) THEN RAISE EXCEPTION 'Confirma los métodos de pago y sus condiciones actuales'; END IF;
 IF a.auction_type='service' THEN result:=public.service_bid_conditions(_auction,_amount,_key,_conditions); ELSE result:=public.place_bid(_auction,_amount,_key); END IF;
 INSERT INTO public.auction_payment_acceptances(auction_id,user_id,bid_id,methods_snapshot) VALUES(a.id,auth.uid(),(result->>'bid_id')::uuid,a.accepted_payment_methods) ON CONFLICT(bid_id) DO NOTHING;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bid_with_payment_acceptance(uuid,numeric,text,boolean,jsonb,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.bid_with_payment_acceptance(uuid,numeric,text,boolean,jsonb,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.bid_payment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.auctions a WHERE a.id=NEW.auction_id AND jsonb_array_length(a.accepted_payment_methods)>0) AND NOT EXISTS(SELECT 1 FROM public.auction_payment_acceptances x WHERE x.bid_id=NEW.id AND x.user_id=NEW.bidder_id) THEN RAISE EXCEPTION 'Debes aceptar las condiciones de pago'; END IF; RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER bid_payment_guard AFTER INSERT ON public.bids DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.bid_payment_guard();
GRANT SELECT(accepted_payment_methods) ON public.auctions TO anon,authenticated;
CREATE OR REPLACE VIEW public.auctions_safe WITH (security_barrier=true) AS SELECT a.id,a.seller_id,a.title,a.description,a.category_id,a.country,a.city,a.scope,a.delivery_terms,a.images,CASE WHEN a.auction_type='item' THEN a.starting_price ELSE NULL END AS starting_price,a.min_increment,a.currency,a.status,a.duration_hours,a.starts_at,a.ends_at,a.original_ends_at,a.current_price,a.bid_count,a.leader_id,a.winner_id,a.has_reserve,a.reserve_met,a.extensions_count,a.flagged,a.created_at,a.updated_at,a.auction_type,a.service_from,a.service_to,a.duration_minutes,a.selection_pending,a.accepted_payment_methods FROM public.auctions a WHERE a.status<>'draft' OR a.seller_id=auth.uid() OR public.is_staff(auth.uid());