ALTER TABLE public.auctions DROP CONSTRAINT auctions_closing_mode_check;
ALTER TABLE public.auctions ADD CONSTRAINT auctions_closing_mode_check CHECK (closing_mode IN ('fixed','reserve','flash'));
ALTER TABLE public.auctions ADD COLUMN closing_phase text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.auctions ADD CONSTRAINT auction_closing_phase_check CHECK (closing_phase IN ('legacy','waiting','bidding','quiet','decision','closed'));
ALTER TABLE public.auctions ALTER COLUMN rules_version SET DEFAULT 4;
COMMENT ON COLUMN public.auctions.closing_mode IS 'Independent product modes fixed/reserve/flash; published rules_version <4 retains original clocks.';
CREATE FUNCTION public.fixed_product_clock(_end timestamptz,_now timestamptz,_first boolean,_hours integer) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN IF _hours NOT IN (24,48,72,168,360,720) THEN RAISE EXCEPTION 'Duración no válida'; END IF; RETURN CASE WHEN _first THEN _now+make_interval(hours=>_hours) ELSE _end END; END $$;
CREATE FUNCTION public.reserve_product_clock(_cap timestamptz,_now timestamptz,_eligible boolean,_minutes integer) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN IF _minutes NOT IN (5,10,15,20,30) THEN RAISE EXCEPTION 'Prórroga no válida'; END IF; RETURN CASE WHEN _eligible THEN _now+make_interval(mins=>_minutes) ELSE _cap END; END $$;
CREATE FUNCTION public.flash_product_clock(_cap timestamptz,_now timestamptz,_first boolean,_minutes integer) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN IF _minutes NOT IN (5,10,15,20,30) THEN RAISE EXCEPTION 'Prórroga no válida'; END IF; IF _first THEN RETURN _now+interval '7 days'; END IF; RETURN CASE WHEN _now>=_cap THEN _now+make_interval(mins=>_minutes) ELSE _cap END; END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.auction_v2_timing()'::regprocedure) INTO d;
 d:=replace(d,'BEGIN'||chr(10)||' IF NEW.rules_version<2', $patch$BEGIN
 IF NEW.rules_version>=4 AND NEW.auction_type='item' THEN
  IF OLD.status='draft' AND NEW.status IN ('active','scheduled') THEN
   NEW.closing_phase:='waiting';
   NEW.ends_at:=coalesce(NEW.starts_at,ts)+CASE WHEN NEW.closing_mode='fixed' THEN interval '8 days' ELSE interval '7 days' END;
   NEW.original_ends_at:=NEW.ends_at;
   NEW.inactivity_cap_at:=CASE WHEN NEW.closing_mode='fixed' THEN NULL ELSE NEW.ends_at END;
  ELSIF NEW.status='active' AND NEW.bid_count>OLD.bid_count THEN
   IF NEW.closing_mode='fixed' THEN
    NEW.ends_at:=public.fixed_product_clock(OLD.ends_at,ts,OLD.bid_count=0,NEW.duration_hours);
    NEW.closing_phase:='bidding';
    IF OLD.bid_count=0 THEN NEW.original_ends_at:=NEW.ends_at; ELSE NEW.original_ends_at:=OLD.original_ends_at; END IF;
   ELSIF NEW.closing_mode='reserve' THEN
    NEW.ends_at:=public.reserve_product_clock(OLD.inactivity_cap_at,ts,NEW.reserve_met,NEW.quiet_period_minutes);
    NEW.closing_phase:=CASE WHEN NEW.reserve_met THEN 'quiet' ELSE 'bidding' END;
   ELSIF NEW.closing_mode='flash' THEN
    NEW.ends_at:=public.flash_product_clock(OLD.inactivity_cap_at,ts,OLD.bid_count=0,NEW.quiet_period_minutes);
    IF OLD.bid_count=0 THEN NEW.inactivity_cap_at:=NEW.ends_at; NEW.original_ends_at:=NEW.ends_at; END IF;
    NEW.closing_phase:=CASE WHEN OLD.bid_count>0 AND ts>=OLD.inactivity_cap_at THEN 'quiet' ELSE 'bidding' END;
   END IF;
   NEW.extensions_count:=OLD.extensions_count+CASE WHEN OLD.bid_count>0 AND NEW.closing_phase='quiet' THEN 1 ELSE 0 END;
  ELSIF NEW.status IN ('ended_sold','ended_unsold','cancelled') THEN NEW.closing_phase:='closed';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.rules_version<2$patch$);
 IF position('fixed_product_clock' in d)=0 THEN RAISE EXCEPTION 'Timing patch did not match'; END IF; EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.auction_mode_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND OLD.status<>'draft' AND (NEW.closing_mode IS DISTINCT FROM OLD.closing_mode OR NEW.quiet_period_seconds IS DISTINCT FROM OLD.quiet_period_seconds OR NEW.quiet_period_minutes IS DISTINCT FROM OLD.quiet_period_minutes OR NEW.wait_days IS DISTINCT FROM OLD.wait_days OR NEW.duration_hours IS DISTINCT FROM OLD.duration_hours OR NEW.rules_version IS DISTINCT FROM OLD.rules_version OR NEW.republished_from IS DISTINCT FROM OLD.republished_from OR NEW.auction_type IS DISTINCT FROM OLD.auction_type) THEN RAISE EXCEPTION 'La modalidad publicada no puede cambiar'; END IF;
 IF NEW.closing_mode IN ('reserve','flash') AND NEW.auction_type<>'item' THEN RAISE EXCEPTION 'Modalidad no válida para servicios'; END IF;
 IF NEW.closing_mode='flash' AND NEW.rules_version<4 THEN RAISE EXCEPTION 'Modalidad no válida para reglas anteriores'; END IF;
 IF NEW.rules_version>=4 AND NEW.closing_mode IN ('reserve','flash') AND NEW.quiet_period_minutes NOT IN (5,10,15,20,30) THEN RAISE EXCEPTION 'Elige 5, 10, 15, 20 o 30 minutos'; END IF;
 IF NEW.closing_mode='reserve' AND NEW.rules_version<2 AND NEW.status IN ('active','scheduled') AND NOT EXISTS(SELECT 1 FROM public.auction_private p WHERE p.auction_id=NEW.id AND p.reserve_price>0) THEN RAISE EXCEPTION 'Modalidad no válida'; END IF;
 IF TG_OP='UPDATE' AND coalesce(current_setting('nexo.engine',true),'')<>'on' THEN NEW.extension_used:=OLD.extension_used; NEW.inactivity_cap_at:=OLD.inactivity_cap_at; NEW.extension_pending:=OLD.extension_pending; NEW.closing_phase:=OLD.closing_phase; END IF;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.save_extended_draft(_data jsonb,_private jsonb,_delivery jsonb,_request jsonb,_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE draft_id uuid; minute_value integer; mode_value text; BEGIN
 IF _data->>'auction_type'='item' AND _delivery IS NULL THEN RAISE EXCEPTION 'Elige modalidad de entrega'; END IF;
 IF _data->>'auction_type'='service' AND _request IS NULL THEN RAISE EXCEPTION 'Completa la solicitud de servicio'; END IF;
 mode_value:=CASE WHEN _data->>'auction_type'='service' THEN 'fixed' ELSE _data->>'closing_mode' END;
 IF mode_value IS NULL OR mode_value NOT IN ('fixed','reserve','flash') THEN RAISE EXCEPTION 'Elige una modalidad'; END IF;
 IF _data->>'auction_type'='item' AND (_data->>'starting_price' IS NULL OR (_data->>'starting_price')::numeric<0) THEN RAISE EXCEPTION 'Indica precio inicial, cero permitido'; END IF;
 IF mode_value='flash' AND ((_private->>'reserve_price') IS NOT NULL OR (_private->>'expected_price') IS NOT NULL) THEN RAISE EXCEPTION 'Libre / Flash no admite reserva ni precio esperado'; END IF;
 minute_value:=CASE WHEN mode_value='fixed' THEN 5 ELSE (_data->>'quiet_period_minutes')::integer END;
 IF minute_value IS NULL OR minute_value NOT IN (5,10,15,20,30) THEN RAISE EXCEPTION 'Elige 5, 10, 15, 20 o 30 minutos'; END IF;
 draft_id:=public.save_auction_draft(_id,_data||jsonb_build_object('service_from',NULL,'service_to',NULL),_private);
 UPDATE public.auctions SET rules_version=4,closing_mode=mode_value,quiet_period_minutes=minute_value,quiet_period_seconds=minute_value*60 WHERE id=draft_id;
 IF _data->>'auction_type'='item' THEN UPDATE public.auctions SET delivery_snapshot=_delivery,delivery_terms=coalesce(_delivery->>'conditions','') WHERE id=draft_id;
 ELSE INSERT INTO public.service_requests(auction_id,request) VALUES(draft_id,_request) ON CONFLICT(auction_id) DO UPDATE SET request=excluded.request,updated_at=now(); END IF;
 RETURN draft_id; END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.publish_auction(uuid)'::regprocedure) INTO d;
 d:=replace(d,'start_value:=greatest', $patch$IF a.rules_version>=4 AND a.auction_type='item' THEN
 IF a.closing_mode='flash' AND (p.reserve_price IS NOT NULL OR p.expected_price IS NOT NULL) THEN RAISE EXCEPTION 'Libre / Flash no admite reserva ni precio esperado'; END IF;
 IF a.closing_mode IN ('reserve','flash') AND a.quiet_period_minutes NOT IN (5,10,15,20,30) THEN RAISE EXCEPTION 'Prórroga no válida'; END IF; END IF;
 start_value:=greatest$patch$);
 IF position('Libre / Flash' in d)=0 THEN RAISE EXCEPTION 'Publish patch did not match'; END IF; EXECUTE d;
 SELECT pg_get_functiondef('public.place_bid(uuid,numeric,text)'::regprocedure) INTO d;
 d:=replace(d,'IF a.id IS NULL OR a.status', $patch$IF a.rules_version>=4 AND a.auction_type='item' AND a.closing_mode='flash' AND a.status='active' AND a.bid_count>0 AND a.closing_phase='bidding' AND ts>=a.inactivity_cap_at THEN
 a.ends_at:=a.inactivity_cap_at+make_interval(mins=>a.quiet_period_minutes); END IF;
 IF a.id IS NULL OR a.status$patch$);
 IF position('a.closing_phase=''bidding''' in d)=0 THEN RAISE EXCEPTION 'Bid patch did not match'; END IF; EXECUTE d;
 SELECT pg_get_functiondef('public.process_auctions()'::regprocedure) INTO d;
 d:=replace(d,'IF a.rules_version>=3 AND a.closing_mode', $patch$IF a.rules_version>=4 AND a.closing_mode='flash' AND a.bid_count>0 AND a.closing_phase='bidding' THEN
 a.ends_at:=a.inactivity_cap_at+make_interval(mins=>a.quiet_period_minutes);
 UPDATE public.auctions SET ends_at=a.ends_at,closing_phase='quiet' WHERE id=a.id;
 IF a.ends_at>clock_timestamp() THEN CONTINUE; END IF; END IF;
 IF a.rules_version>=3 AND a.closing_mode$patch$);
 d:=replace(d,'extension_pending=true WHERE id=a.id','extension_pending=true,closing_phase=CASE WHEN a.rules_version>=4 THEN ''decision'' ELSE closing_phase END WHERE id=a.id');
 IF position('closing_phase=''quiet''' in d)=0 THEN RAISE EXCEPTION 'Close patch did not match'; END IF; EXECUTE d;
END $$;
CREATE OR REPLACE TRIGGER auction_v2_timing BEFORE UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.auction_v2_timing();
CREATE OR REPLACE TRIGGER auction_mode_guard BEFORE INSERT OR UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.auction_mode_guard();
CREATE FUNCTION public.flash_private_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE mode_value text; BEGIN
 SELECT closing_mode INTO mode_value FROM public.auctions WHERE id=NEW.auction_id FOR UPDATE;
 IF mode_value='flash' AND (NEW.reserve_price IS NOT NULL OR NEW.expected_price IS NOT NULL) THEN RAISE EXCEPTION 'Libre / Flash no admite reserva ni precio esperado'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER flash_private_guard BEFORE INSERT OR UPDATE ON public.auction_private FOR EACH ROW EXECUTE FUNCTION public.flash_private_guard();
DO $$ DECLARE d text; BEGIN SELECT pg_get_viewdef('public.auctions_safe'::regclass,true) INTO d;
 d:=replace(d,'a.extension_pending','a.extension_pending, a.closing_phase');
 EXECUTE 'CREATE OR REPLACE VIEW public.auctions_safe WITH (security_invoker=false,security_barrier=true) AS '||d; END $$;