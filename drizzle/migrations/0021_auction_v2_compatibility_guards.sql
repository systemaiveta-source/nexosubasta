CREATE OR REPLACE FUNCTION public.auction_mode_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status<>'draft' AND (NEW.closing_mode IS DISTINCT FROM OLD.closing_mode OR NEW.quiet_period_seconds IS DISTINCT FROM OLD.quiet_period_seconds OR NEW.wait_days IS DISTINCT FROM OLD.wait_days OR NEW.rules_version IS DISTINCT FROM OLD.rules_version OR NEW.republished_from IS DISTINCT FROM OLD.republished_from) THEN RAISE EXCEPTION 'La modalidad publicada no puede cambiar'; END IF;
 IF NEW.closing_mode='reserve' AND (NEW.auction_type<>'item' OR (NEW.rules_version<2 AND NEW.status IN ('active','scheduled') AND NOT EXISTS(SELECT 1 FROM public.auction_private p WHERE p.auction_id=NEW.id AND p.reserve_price>0))) THEN RAISE EXCEPTION 'Modalidad no válida'; END IF;
 IF TG_OP='UPDATE' AND coalesce(current_setting('nexo.engine',true),'')<>'on' THEN NEW.extension_used:=OLD.extension_used; NEW.inactivity_cap_at:=OLD.inactivity_cap_at; END IF;
 RETURN NEW;
END $$;
DO $$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.save_extended_draft(jsonb,jsonb,jsonb,jsonb,uuid)'::regprocedure) INTO d;
 d:=replace(d,'AND NOT EXISTS(SELECT 1 FROM public.auction_private','AND (SELECT rules_version FROM public.auctions WHERE id=draft_id)<2 AND NOT EXISTS(SELECT 1 FROM public.auction_private');
 EXECUTE d;
 SELECT pg_get_functiondef('public.publish_auction(uuid)'::regprocedure) INTO d;
 d:=replace(d,'a.duration_hours>settings.max_duration_days*24','(a.rules_version<2 AND a.duration_hours>settings.max_duration_days*24) OR (a.rules_version>=2 AND a.duration_hours NOT IN (24,48,72,168,360,720))');
 EXECUTE d;
END $$;