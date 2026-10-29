CREATE OR REPLACE FUNCTION public.save_auction_draft(_id uuid,_data jsonb,_private jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE draft_id uuid; a public.auctions; kind_value text; currency_value text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'seller') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') THEN RAISE EXCEPTION 'Cuenta no autorizada para subastar'; END IF;
 kind_value:=_data->>'auction_type'; currency_value:=_data->>'currency';
 IF kind_value NOT IN ('item','service') OR currency_value !~ '^[A-Z]{3}$' OR length(trim(_data->>'title')) NOT BETWEEN 5 AND 120 OR length(trim(_data->>'description')) NOT BETWEEN 20 AND 4000 OR (_data->>'min_increment')::numeric<=0 THEN RAISE EXCEPTION 'Revisa título, descripción, moneda e incremento'; END IF;
 IF (_data->>'category_id') IS NOT NULL AND EXISTS(SELECT 1 FROM public.categories WHERE id=(_data->>'category_id')::uuid AND slug='nft-cripto') THEN RAISE EXCEPTION 'Categoría no disponible en esta entrega'; END IF;
 IF _id IS NOT NULL THEN SELECT * INTO a FROM public.auctions WHERE id=_id FOR UPDATE; IF a.id IS NULL OR a.seller_id<>auth.uid() OR a.status<>'draft' THEN RAISE EXCEPTION 'Borrador no disponible'; END IF; draft_id:=a.id;
 ELSE INSERT INTO public.auctions(seller_id,title,description,starting_price,auction_type) VALUES(auth.uid(),trim(_data->>'title'),trim(_data->>'description'),CASE WHEN kind_value='service' THEN 1 ELSE (_data->>'starting_price')::numeric END,kind_value) RETURNING id INTO draft_id; END IF;
 UPDATE public.auctions SET title=trim(_data->>'title'),description=trim(_data->>'description'),category_id=(_data->>'category_id')::uuid,country=_data->>'country',city=_data->>'city',scope=coalesce(_data->>'scope','national'),delivery_terms=coalesce(_data->>'delivery_terms',''),images=ARRAY(SELECT v.value FROM jsonb_array_elements_text(coalesce(_data->'images','[]'::jsonb)) v(value)),starting_price=CASE WHEN kind_value='service' THEN 1 ELSE (_data->>'starting_price')::numeric END,min_increment=(_data->>'min_increment')::numeric,currency=currency_value,auction_type=kind_value,duration_hours=(_data->>'duration_hours')::int,duration_minutes=(_data->>'duration_minutes')::int,service_from=_data->>'service_from',service_to=_data->>'service_to',accepted_payment_methods=coalesce(_data->'accepted_payment_methods','[]'::jsonb) WHERE id=draft_id;
 INSERT INTO public.auction_private(auction_id,expected_price,reserve_price,service_budget) VALUES(draft_id,CASE WHEN kind_value='item' THEN (_private->>'expected_price')::numeric END,CASE WHEN kind_value='item' THEN (_private->>'reserve_price')::numeric END,CASE WHEN kind_value='service' THEN (_private->>'service_budget')::numeric END) ON CONFLICT(auction_id) DO UPDATE SET expected_price=excluded.expected_price,reserve_price=excluded.reserve_price,service_budget=excluded.service_budget;
 PERFORM public.set_auction_start(draft_id,(_data->>'starts_at')::timestamptz);
 RETURN draft_id;
END $$;
REVOKE ALL ON FUNCTION public.save_auction_draft(uuid,jsonb,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_auction_draft(uuid,jsonb,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.my_auction_draft(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; private_data jsonb;
BEGIN
 SELECT * INTO a FROM public.auctions WHERE id=_id AND seller_id=auth.uid() AND status='draft'; IF a.id IS NULL THEN RAISE EXCEPTION 'Borrador no disponible'; END IF;
 SELECT to_jsonb(p) INTO private_data FROM public.auction_private p WHERE p.auction_id=a.id;
 RETURN jsonb_build_object('auction',to_jsonb(a),'private',coalesce(private_data,'{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.my_auction_draft(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.my_auction_draft(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.publish_auction(_auction_id uuid) RETURNS public.auctions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.auctions; settings public.platform_settings; p public.auction_private; start_value timestamptz; end_value timestamptz; active_limit integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('publish:'||auth.uid()::text,0));
 SELECT * INTO a FROM public.auctions WHERE id=_auction_id FOR UPDATE;
 IF a.id IS NULL OR a.seller_id<>auth.uid() OR a.status<>'draft' THEN RAISE EXCEPTION 'Borrador no disponible'; END IF;
 IF NOT public.has_role(auth.uid(),'seller') OR NOT public.has_active_seller_sub(auth.uid()) THEN RAISE EXCEPTION 'Necesitas cuenta de subastador y membresía activa'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
 SELECT pl.max_active_auctions INTO active_limit FROM public.subscriptions sub JOIN public.plans pl ON pl.id=sub.plan_id WHERE sub.user_id=auth.uid() AND sub.status='active' AND sub.starts_at<=now() AND sub.ends_at>now() AND pl.audience='seller' ORDER BY sub.ends_at DESC LIMIT 1;
 IF active_limit IS NOT NULL AND (SELECT count(*) FROM public.auctions WHERE seller_id=auth.uid() AND status IN ('active','scheduled'))>=active_limit THEN RAISE EXCEPTION 'Alcanzaste el límite de subastas activas de tu plan'; END IF;
 IF length(trim(a.title))<5 OR length(trim(a.description))<20 THEN RAISE EXCEPTION 'Revisa título y descripción'; END IF;
 IF EXISTS(SELECT 1 FROM public.categories WHERE id=a.category_id AND slug='nft-cripto') THEN RAISE EXCEPTION 'Categoría no disponible'; END IF;
 SELECT * INTO settings FROM public.platform_settings WHERE id=1;
 IF a.auction_type='service' THEN IF a.duration_minutes IS NULL OR a.duration_minutes<1 OR a.duration_minutes>settings.max_duration_days*1440 THEN RAISE EXCEPTION 'Duración no válida'; END IF;
 ELSE IF a.category_id IS NULL OR cardinality(a.images)<1 OR a.duration_hours<settings.min_duration_hours OR a.duration_hours>settings.max_duration_days*24 THEN RAISE EXCEPTION 'Revisa categoría, fotografías y duración'; END IF; END IF;
 IF a.min_increment<=0 THEN RAISE EXCEPTION 'Incremento no válido'; END IF;
 SELECT * INTO p FROM public.auction_private WHERE auction_id=a.id;
 start_value:=greatest(coalesce(a.starts_at,clock_timestamp()),clock_timestamp()); end_value:=start_value+CASE WHEN a.auction_type='service' THEN make_interval(mins=>a.duration_minutes) ELSE make_interval(hours=>a.duration_hours) END;
 PERFORM set_config('nexo.engine','on',true);
 UPDATE public.auctions SET status=CASE WHEN start_value<=clock_timestamp()+interval '5 seconds' THEN 'active' ELSE 'scheduled' END,starts_at=start_value,ends_at=end_value,original_ends_at=end_value,has_reserve=(a.auction_type='item' AND p.reserve_price IS NOT NULL),reserve_met=false WHERE id=a.id RETURNING * INTO a;
 PERFORM set_config('nexo.engine','off',true);
 INSERT INTO public.auction_events(auction_id,kind,details) VALUES(a.id,'published',jsonb_build_object('starts_at',start_value,'ends_at',end_value)); RETURN a;
END $$;