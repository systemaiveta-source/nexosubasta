ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS rules_version smallint NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS wait_days integer NOT NULL DEFAULT 7,
 ADD COLUMN IF NOT EXISTS inactivity_cap_at timestamptz,
 ADD COLUMN IF NOT EXISTS extension_used boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS republished_from uuid REFERENCES public.auctions(id);
ALTER TABLE public.auctions ALTER COLUMN rules_version SET DEFAULT 2;
ALTER TABLE public.auctions ADD CONSTRAINT auctions_wait_days_check CHECK (wait_days IN (7,15,30));
ALTER TABLE public.auctions DROP CONSTRAINT auctions_starting_price_check;
ALTER TABLE public.auctions ADD CONSTRAINT auctions_starting_price_check CHECK (starting_price >= 0);

CREATE OR REPLACE FUNCTION public.auction_v2_timing() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ts timestamptz:=clock_timestamp();
BEGIN
 IF NEW.rules_version<2 THEN RETURN NEW; END IF;
 IF OLD.status='draft' AND NEW.status IN ('active','scheduled') THEN
  NEW.ends_at:=coalesce(NEW.starts_at,ts)+make_interval(days=>NEW.wait_days); NEW.original_ends_at:=NEW.ends_at; RETURN NEW;
 END IF;
 IF NEW.status='active' AND NEW.bid_count>OLD.bid_count THEN
  IF OLD.bid_count=0 THEN
   IF NEW.auction_type='service' THEN NEW.ends_at:=ts+make_interval(mins=>NEW.duration_minutes);
   ELSIF NEW.closing_mode='fixed' THEN NEW.ends_at:=ts+make_interval(hours=>NEW.duration_hours);
   ELSE NEW.inactivity_cap_at:=ts+interval '7 days'; NEW.ends_at:=least(ts+make_interval(secs=>NEW.quiet_period_seconds),NEW.inactivity_cap_at); END IF;
   NEW.original_ends_at:=NEW.ends_at;
  ELSIF NEW.auction_type='item' AND NEW.closing_mode='reserve' THEN
   NEW.ends_at:=least(ts+make_interval(secs=>NEW.quiet_period_seconds),coalesce(NEW.inactivity_cap_at,ts+make_interval(secs=>NEW.quiet_period_seconds)));
  ELSE NEW.ends_at:=OLD.ends_at; END IF;
  NEW.extensions_count:=OLD.extensions_count;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER auction_v2_timing BEFORE UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.auction_v2_timing();

CREATE OR REPLACE FUNCTION public.auction_v2_extension_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF EXISTS(SELECT 1 FROM public.auctions WHERE id=NEW.auction_id AND rules_version>=2) THEN RETURN NULL; END IF; RETURN NEW; END $$;
CREATE TRIGGER auction_v2_extension_log BEFORE INSERT ON public.auction_extensions FOR EACH ROW EXECUTE FUNCTION public.auction_v2_extension_log();

CREATE OR REPLACE FUNCTION public.set_auction_wait_days(_auction uuid, _days integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _days NOT IN (7,15,30) THEN RAISE EXCEPTION 'Espera no válida'; END IF;
 UPDATE public.auctions SET wait_days=_days WHERE id=_auction AND seller_id=auth.uid() AND status='draft';
 IF NOT FOUND THEN RAISE EXCEPTION 'Borrador no disponible'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.extend_reserve_auction(_auction uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions;
BEGIN
 SELECT * INTO a FROM public.auctions WHERE id=_auction FOR UPDATE;
 IF a.id IS NULL OR a.seller_id<>auth.uid() OR a.status<>'active' OR a.rules_version<2 OR a.closing_mode<>'reserve' OR a.inactivity_cap_at IS NULL OR a.extension_used THEN RAISE EXCEPTION 'Extensión no disponible'; END IF;
 PERFORM set_config('nexo.engine','on',true);
 UPDATE public.auctions SET inactivity_cap_at=a.inactivity_cap_at+interval '7 days',extension_used=true WHERE id=a.id;
 PERFORM set_config('nexo.engine','off',true);
 INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'extension_decision',jsonb_build_object('new_cap',a.inactivity_cap_at+interval '7 days'));
 RETURN a.inactivity_cap_at+interval '7 days';
END $$;

CREATE OR REPLACE FUNCTION public.republish_auction(_auction uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; nid uuid;
BEGIN
 SELECT * INTO a FROM public.auctions WHERE id=_auction;
 IF a.id IS NULL OR a.seller_id<>auth.uid() OR a.status<>'ended_unsold' OR a.winner_id IS NOT NULL OR a.selection_pending OR EXISTS(SELECT 1 FROM public.transactions t WHERE t.auction_id=a.id) THEN RAISE EXCEPTION 'Solo puedes republicar subastas finalizadas sin ganador'; END IF;
 INSERT INTO public.auctions(seller_id,title,description,category_id,country,city,scope,delivery_terms,images,starting_price,min_increment,currency,duration_hours,auction_type,service_from,service_to,duration_minutes,accepted_payment_methods,delivery_snapshot,closing_mode,quiet_period_seconds,wait_days,republished_from)
 VALUES(a.seller_id,a.title,a.description,a.category_id,a.country,a.city,a.scope,a.delivery_terms,a.images,a.starting_price,a.min_increment,a.currency,a.duration_hours,a.auction_type,a.service_from,a.service_to,a.duration_minutes,a.accepted_payment_methods,a.delivery_snapshot,a.closing_mode,a.quiet_period_seconds,a.wait_days,a.id) RETURNING id INTO nid;
 INSERT INTO public.auction_private(auction_id,expected_price,reserve_price,service_budget) SELECT nid,expected_price,reserve_price,service_budget FROM public.auction_private WHERE auction_id=a.id;
 INSERT INTO public.service_requests(auction_id,request,locations_verified) SELECT nid,request,false FROM public.service_requests WHERE auction_id=a.id;
 RETURN nid;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_auction_wait_days(uuid,integer),public.extend_reserve_auction(uuid),public.republish_auction(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_auction_wait_days(uuid,integer),public.extend_reserve_auction(uuid),public.republish_auction(uuid) TO authenticated;