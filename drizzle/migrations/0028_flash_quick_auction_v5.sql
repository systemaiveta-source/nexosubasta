-- Flash rápida (rules_version 5): sin fase de 7 días; la primera puja válida inicia la prórroga elegida y cada puja válida la reinicia completa. Sin reserva ni precio esperado (ya prohibidos). Sin extensión manual. Las subastas flash publicadas con rules_version 4 conservan su reloj anterior.
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.save_extended_draft(jsonb,jsonb,jsonb,jsonb,uuid)'::regprocedure) INTO d;
 d:=replace(d,'UPDATE public.auctions SET closing_mode=mode_value,rules_version=4,quiet_period_minutes=minute_value,quiet_period_seconds=minute_value*60 WHERE id=_id;',
  'UPDATE public.auctions SET closing_mode=mode_value,rules_version=CASE WHEN mode_value=''flash'' THEN 5 ELSE 4 END,quiet_period_minutes=minute_value,quiet_period_seconds=minute_value*60 WHERE id=_id;');
 d:=replace(d,'UPDATE public.auctions SET rules_version=4,closing_mode=mode_value,quiet_period_minutes=minute_value,quiet_period_seconds=minute_value*60 WHERE id=draft_id;',
  'UPDATE public.auctions SET rules_version=CASE WHEN mode_value=''flash'' THEN 5 ELSE 4 END,closing_mode=mode_value,quiet_period_minutes=minute_value,quiet_period_seconds=minute_value*60 WHERE id=draft_id;');
 IF position('THEN 5 ELSE 4' in d)=0 THEN RAISE EXCEPTION 'Draft patch did not match'; END IF; EXECUTE d;

 SELECT pg_get_functiondef('public.auction_v2_timing()'::regprocedure) INTO d;
 d:=replace(d,'NEW.inactivity_cap_at:=CASE WHEN NEW.closing_mode=''fixed'' THEN NULL ELSE NEW.ends_at END;',
  'NEW.inactivity_cap_at:=CASE WHEN NEW.closing_mode=''fixed'' OR (NEW.closing_mode=''flash'' AND NEW.rules_version>=5) THEN NULL ELSE NEW.ends_at END;');
 d:=replace(d,$old$   ELSIF NEW.closing_mode='flash' THEN
    NEW.ends_at:=public.flash_product_clock(OLD.inactivity_cap_at,ts,OLD.bid_count=0,NEW.quiet_period_minutes);
    IF OLD.bid_count=0 THEN NEW.inactivity_cap_at:=NEW.ends_at; NEW.original_ends_at:=NEW.ends_at; END IF;
    NEW.closing_phase:=CASE WHEN OLD.bid_count>0 AND ts>=OLD.inactivity_cap_at THEN 'quiet' ELSE 'bidding' END;$old$,
  $new$   ELSIF NEW.closing_mode='flash' THEN
    IF NEW.rules_version>=5 THEN
     NEW.ends_at:=ts+make_interval(mins=>NEW.quiet_period_minutes);
     NEW.closing_phase:='quiet';
    ELSE
     NEW.ends_at:=public.flash_product_clock(OLD.inactivity_cap_at,ts,OLD.bid_count=0,NEW.quiet_period_minutes);
     IF OLD.bid_count=0 THEN NEW.inactivity_cap_at:=NEW.ends_at; NEW.original_ends_at:=NEW.ends_at; END IF;
     NEW.closing_phase:=CASE WHEN OLD.bid_count>0 AND ts>=OLD.inactivity_cap_at THEN 'quiet' ELSE 'bidding' END;
    END IF;$new$);
 IF position('rules_version>=5' in d)=0 THEN RAISE EXCEPTION 'Timing patch did not match'; END IF; EXECUTE d;

 SELECT pg_get_functiondef('public.process_auctions()'::regprocedure) INTO d;
 d:=replace(d,'IF a.rules_version>=4 AND a.closing_mode=''flash'' AND a.bid_count>0 AND a.closing_phase=''bidding'' THEN',
  'IF a.rules_version=4 AND a.closing_mode=''flash'' AND a.bid_count>0 AND a.closing_phase=''bidding'' THEN');
 IF position('a.rules_version=4 AND a.closing_mode=''flash''' in d)=0 THEN RAISE EXCEPTION 'Process patch did not match'; END IF; EXECUTE d;

 SELECT pg_get_functiondef('public.place_bid(uuid,numeric,text)'::regprocedure) INTO d;
 d:=replace(d,'IF a.rules_version>=4 AND a.auction_type=''item'' AND a.closing_mode=''flash'' AND a.status=''active''',
  'IF a.rules_version=4 AND a.auction_type=''item'' AND a.closing_mode=''flash'' AND a.status=''active''');
 IF position('a.rules_version=4 AND a.auction_type=''item''' in d)=0 THEN RAISE EXCEPTION 'Bid patch did not match'; END IF; EXECUTE d;
END $$;