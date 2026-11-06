DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.save_extended_draft(jsonb,jsonb,jsonb,jsonb,uuid)'::regprocedure) INTO d;
 d:=replace(d,'draft_id:=public.save_auction_draft', $patch$IF _id IS NOT NULL THEN
  PERFORM 1 FROM public.auctions WHERE id=_id AND seller_id=auth.uid() AND status='draft' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Borrador no disponible'; END IF;
  UPDATE public.auctions SET closing_mode=mode_value,rules_version=4,quiet_period_minutes=minute_value,quiet_period_seconds=minute_value*60 WHERE id=_id;
 END IF;
 draft_id:=public.save_auction_draft$patch$);
 IF position('Borrador no disponible' in d)=0 THEN RAISE EXCEPTION 'Draft mode patch did not match'; END IF; EXECUTE d;
 SELECT pg_get_functiondef('public.auction_v2_timing()'::regprocedure) INTO d;
 d:=replace(d,'NEW.ends_at:=coalesce(NEW.starts_at,ts)+CASE WHEN NEW.closing_mode=''fixed'' THEN interval ''8 days'' ELSE interval ''7 days'' END;', 'NEW.ends_at:=CASE WHEN NEW.closing_mode=''fixed'' THEN ts+interval ''8 days'' ELSE coalesce(NEW.starts_at,ts)+interval ''7 days'' END;');
 d:=replace(d,'IF NEW.rules_version>=3 AND NEW.auction_type=''item'' THEN'||chr(10)||'   NEW.ends_at:=CASE WHEN NEW.closing_mode=''fixed'' THEN ts+interval ''8 days'' ELSE coalesce(NEW.starts_at,ts)+interval ''7 days'' END;', 'IF NEW.rules_version>=3 AND NEW.auction_type=''item'' THEN'||chr(10)||'   NEW.ends_at:=coalesce(NEW.starts_at,ts)+CASE WHEN NEW.closing_mode=''fixed'' THEN interval ''8 days'' ELSE interval ''7 days'' END;');
 EXECUTE d;
 SELECT pg_get_functiondef('public.process_auctions()'::regprocedure) INTO d;
 d:=replace(d,$anchor$WHERE status='scheduled' AND starts_at<=clock_timestamp()$anchor$, $patch$WHERE status='scheduled' AND (starts_at<=clock_timestamp() OR (rules_version>=4 AND auction_type='item' AND closing_mode='fixed' AND bid_count=0 AND ends_at<=clock_timestamp()))$patch$);
 EXECUTE d;
END $$;