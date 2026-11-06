ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS quiet_period_minutes integer NOT NULL DEFAULT 5, ADD COLUMN IF NOT EXISTS extension_pending boolean NOT NULL DEFAULT false;
UPDATE public.auctions SET quiet_period_minutes=ceil(quiet_period_seconds::numeric/60)::integer;
ALTER TABLE public.auctions ADD CONSTRAINT auction_quiet_minutes_check CHECK (quiet_period_minutes BETWEEN 1 AND 1440);
ALTER TABLE public.auctions ALTER COLUMN rules_version SET DEFAULT 3;
COMMENT ON COLUMN public.auctions.quiet_period_seconds IS 'DEPRECATED for rules_version >= 3: use quiet_period_minutes; retained for published legacy auctions';
CREATE OR REPLACE FUNCTION public.auction_v2_timing() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ts timestamptz:=clock_timestamp();
BEGIN
 IF NEW.rules_version<2 THEN RETURN NEW; END IF;
 IF OLD.status='draft' AND NEW.status IN ('active','scheduled') THEN
  IF NEW.rules_version>=3 AND NEW.auction_type='item' THEN
   NEW.ends_at:=coalesce(NEW.starts_at,ts)+CASE WHEN NEW.closing_mode='fixed' THEN interval '8 days' ELSE interval '7 days' END;
   IF NEW.closing_mode='reserve' THEN NEW.inactivity_cap_at:=NEW.ends_at; END IF;
  ELSE NEW.ends_at:=coalesce(NEW.starts_at,ts)+make_interval(days=>NEW.wait_days); END IF;
  NEW.original_ends_at:=NEW.ends_at; RETURN NEW;
 END IF;
 IF NEW.status='active' AND NEW.bid_count>OLD.bid_count THEN
  IF NEW.rules_version>=3 AND NEW.auction_type='item' THEN
   IF NEW.closing_mode='fixed' THEN
    IF OLD.bid_count=0 THEN NEW.ends_at:=ts+make_interval(hours=>NEW.duration_hours); NEW.original_ends_at:=NEW.ends_at;
    ELSE NEW.ends_at:=OLD.ends_at; NEW.original_ends_at:=OLD.original_ends_at; END IF;
   ELSE
    NEW.ends_at:=CASE WHEN NEW.reserve_met THEN least(ts+make_interval(mins=>NEW.quiet_period_minutes),NEW.inactivity_cap_at) ELSE NEW.inactivity_cap_at END;
   END IF;
  ELSE
   IF OLD.bid_count=0 THEN
    IF NEW.auction_type='service' THEN NEW.ends_at:=ts+make_interval(mins=>NEW.duration_minutes);
    ELSIF NEW.closing_mode='fixed' THEN NEW.ends_at:=ts+make_interval(hours=>NEW.duration_hours);
    ELSE NEW.inactivity_cap_at:=ts+interval '7 days'; NEW.ends_at:=least(ts+make_interval(secs=>NEW.quiet_period_seconds),NEW.inactivity_cap_at); END IF;
    NEW.original_ends_at:=NEW.ends_at;
   ELSIF NEW.auction_type='item' AND NEW.closing_mode='reserve' THEN NEW.ends_at:=least(ts+make_interval(secs=>NEW.quiet_period_seconds),coalesce(NEW.inactivity_cap_at,ts+make_interval(secs=>NEW.quiet_period_seconds)));
   ELSE NEW.ends_at:=OLD.ends_at; END IF;
  END IF;
  NEW.extensions_count:=OLD.extensions_count;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.auction_mode_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status<>'draft' AND (NEW.closing_mode IS DISTINCT FROM OLD.closing_mode OR NEW.quiet_period_seconds IS DISTINCT FROM OLD.quiet_period_seconds OR NEW.quiet_period_minutes IS DISTINCT FROM OLD.quiet_period_minutes OR NEW.wait_days IS DISTINCT FROM OLD.wait_days OR NEW.rules_version IS DISTINCT FROM OLD.rules_version OR NEW.republished_from IS DISTINCT FROM OLD.republished_from) THEN RAISE EXCEPTION 'La modalidad publicada no puede cambiar'; END IF;
 IF NEW.closing_mode='reserve' AND (NEW.auction_type<>'item' OR (NEW.rules_version<2 AND NEW.status IN ('active','scheduled') AND NOT EXISTS(SELECT 1 FROM public.auction_private p WHERE p.auction_id=NEW.id AND p.reserve_price>0))) THEN RAISE EXCEPTION 'Modalidad no válida'; END IF;
 IF TG_OP='UPDATE' AND coalesce(current_setting('nexo.engine',true),'')<>'on' THEN NEW.extension_used:=OLD.extension_used; NEW.inactivity_cap_at:=OLD.inactivity_cap_at; NEW.extension_pending:=OLD.extension_pending; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.save_extended_draft(_data jsonb,_private jsonb,_delivery jsonb,_request jsonb,_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE draft_id uuid; minute_value integer; version_value integer;
BEGIN
 IF _data->>'auction_type'='item' AND _delivery IS NULL THEN RAISE EXCEPTION 'Elige modalidad de entrega'; END IF;
 IF _data->>'auction_type'='service' AND _request IS NULL THEN RAISE EXCEPTION 'Completa la solicitud de servicio'; END IF;
 IF coalesce(_data->>'closing_mode','fixed')='reserve' AND _data->>'auction_type'<>'item' THEN RAISE EXCEPTION 'Modalidad no válida'; END IF;
 minute_value:=coalesce((_data->>'quiet_period_minutes')::integer,ceil(coalesce((_data->>'quiet_period_seconds')::numeric,300)/60)::integer);
 IF minute_value NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Período no válido: usa minutos entre 1 y 1440'; END IF;
 draft_id:=public.save_auction_draft(_id,_data||jsonb_build_object('service_from',NULL,'service_to',NULL),_private);
 SELECT rules_version INTO version_value FROM public.auctions WHERE id=draft_id;
 IF version_value<3 AND coalesce(_data->>'closing_mode','fixed')='reserve' AND coalesce((_private->>'reserve_price')::numeric,0)<=0 THEN RAISE EXCEPTION 'La modalidad anterior exige reserva privada'; END IF;
 UPDATE public.auctions SET closing_mode=coalesce(_data->>'closing_mode','fixed'),quiet_period_minutes=minute_value,quiet_period_seconds=minute_value*60 WHERE id=draft_id;
 IF _data->>'auction_type'='item' THEN UPDATE public.auctions SET delivery_snapshot=_delivery,delivery_terms=coalesce(_delivery->>'conditions','') WHERE id=draft_id;
 ELSE INSERT INTO public.service_requests(auction_id,request) VALUES(draft_id,_request) ON CONFLICT(auction_id) DO UPDATE SET request=excluded.request,updated_at=now(); END IF;
 RETURN draft_id;
END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.place_bid(uuid,numeric,text)'::regprocedure) INTO d;
 d:=replace(d,'_amount<=0','_amount<0');
 d:=replace(d,'new_end:=public.auction_bid_deadline(a.closing_mode,a.ends_at,ts,met_value,a.quiet_period_seconds);','new_end:=CASE WHEN a.rules_version>=3 AND a.auction_type=''item'' THEN a.ends_at ELSE public.auction_bid_deadline(a.closing_mode,a.ends_at,ts,met_value,a.quiet_period_seconds) END;');
 d:=replace(d,'WHERE id=a.id;'||chr(10)||' PERFORM set_config(''nexo.engine'',''off'',true);','WHERE id=a.id RETURNING ends_at INTO new_end;'||chr(10)||' PERFORM set_config(''nexo.engine'',''off'',true);');
 IF position('RETURNING ends_at INTO new_end' in d)=0 THEN RAISE EXCEPTION 'Bid deadline patch did not match'; END IF;
 EXECUTE d;
 SELECT pg_get_functiondef('public.process_auctions()'::regprocedure) INTO d;
 d:=replace(d,'END IF;'||chr(10)||'  SELECT reserve_price INTO reserve_value', 'END IF;'||chr(10)||'  IF a.rules_version>=3 AND a.closing_mode=''reserve'' AND a.bid_count>0 AND NOT a.reserve_met AND NOT a.extension_used THEN'||chr(10)||'   IF NOT a.extension_pending THEN UPDATE public.auctions SET extension_pending=true WHERE id=a.id; PERFORM public.notify(a.seller_id,''Decide el cierre de tu subasta'',''Puedes extender una sola vez otros 7 días o finalizar sin ganador.'',''/vendedor''); END IF; CONTINUE;'||chr(10)||'  END IF;'||chr(10)||'  SELECT reserve_price INTO reserve_value');
 IF position('extension_pending=true' in d)=0 THEN RAISE EXCEPTION 'Close decision patch did not match'; END IF;
 EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.extend_reserve_auction(_auction uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; ts timestamptz:=clock_timestamp(); new_cap timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 SELECT * INTO a FROM public.auctions WHERE id=_auction FOR UPDATE;
 IF a.id IS NULL OR a.seller_id<>auth.uid() OR a.status<>'active' OR a.rules_version<3 OR a.auction_type<>'item' OR a.closing_mode<>'reserve' OR a.extension_used OR a.bid_count=0 OR a.reserve_met OR ts<a.inactivity_cap_at THEN RAISE EXCEPTION 'Extensión no disponible'; END IF;
 new_cap:=ts+interval '7 days';
 PERFORM set_config('nexo.engine','on',true);
 UPDATE public.auctions SET inactivity_cap_at=new_cap,ends_at=new_cap,extension_used=true,extension_pending=false WHERE id=a.id;
 PERFORM set_config('nexo.engine','off',true);
 INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'extension_decision',jsonb_build_object('new_cap',new_cap)); RETURN new_cap;
END $$;
CREATE OR REPLACE FUNCTION public.finish_reserve_auction(_auction uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 SELECT * INTO a FROM public.auctions WHERE id=_auction FOR UPDATE;
 IF a.id IS NULL OR a.seller_id<>auth.uid() OR a.status<>'active' OR a.rules_version<3 OR a.auction_type<>'item' OR a.closing_mode<>'reserve' OR a.reserve_met OR clock_timestamp()<a.inactivity_cap_at THEN RAISE EXCEPTION 'Finalización no disponible'; END IF;
 PERFORM set_config('nexo.engine','on',true);
 UPDATE public.auctions SET status='ended_unsold',winner_id=NULL,extension_pending=false WHERE id=a.id;
 PERFORM set_config('nexo.engine','off',true);
 INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'closed',jsonb_build_object('sold',false,'seller_decision',true));
END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.republish_auction(uuid)'::regprocedure) INTO d;
 d:=replace(d,'WHERE id=_auction;','WHERE id=_auction FOR UPDATE;');
 d:=replace(d,' INSERT INTO public.auctions(seller_id',' IF EXISTS(SELECT 1 FROM public.auctions WHERE republished_from=a.id AND status IN (''draft'',''active'',''scheduled'')) THEN RAISE EXCEPTION ''Ya existe una republicación pendiente o activa''; END IF;'||chr(10)||' INSERT INTO public.auctions(seller_id');
 d:=replace(d,' INSERT INTO public.auction_private(auction_id',' UPDATE public.auctions SET quiet_period_minutes=a.quiet_period_minutes WHERE id=nid;'||chr(10)||' INSERT INTO public.auction_private(auction_id');
 EXECUTE d;
END $$;
REVOKE EXECUTE ON FUNCTION public.finish_reserve_auction(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finish_reserve_auction(uuid) TO authenticated;
