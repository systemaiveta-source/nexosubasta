DO $$ DECLARE d text; BEGIN
 SELECT pg_get_viewdef('public.auctions_safe'::regclass,true) INTO d;
 IF position('closing_phase' in d)=0 THEN
  d:=replace(d,'    extension_pending','    extension_pending, closing_phase');
  IF position('closing_phase' in d)=0 THEN RAISE EXCEPTION 'Public clock projection patch did not match'; END IF;
  EXECUTE 'CREATE OR REPLACE VIEW public.auctions_safe WITH (security_invoker=false,security_barrier=true) AS '||d;
 END IF;
END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.extend_reserve_auction(uuid)'::regprocedure) INTO d;
 d:=replace(d,'extension_pending=false WHERE id=a.id','extension_pending=false,closing_phase=CASE WHEN a.rules_version>=4 THEN ''bidding'' ELSE closing_phase END WHERE id=a.id');
 IF position('closing_phase=CASE' in d)=0 THEN RAISE EXCEPTION 'Extension phase patch did not match'; END IF; EXECUTE d;
END $$;