ALTER TABLE public.notification_preferences ALTER COLUMN new_auctions SET DEFAULT true;
ALTER TABLE public.notification_preferences ADD COLUMN push_consent_initialized boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.notification_preferences.categories IS 'DEPRECATED: new auction notifications include all categories';
ALTER TABLE public.notifications ADD COLUMN event_kind text NOT NULL DEFAULT 'activity';
CREATE INDEX notifications_read_owner_idx ON public.notifications(user_id) WHERE read=true;
CREATE OR REPLACE FUNCTION public.new_auction_notifications() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE event_id uuid; category_label text;
BEGIN
 IF NEW.status='active' AND (TG_OP='INSERT' OR OLD.status IN ('draft','scheduled')) THEN
  INSERT INTO public.auction_push_events(auction_id) VALUES(NEW.id) ON CONFLICT DO NOTHING RETURNING auction_id INTO event_id;
  IF event_id IS NULL THEN RETURN NEW; END IF;
  SELECT c.name INTO category_label FROM public.categories c WHERE c.id=NEW.category_id;
  INSERT INTO public.notifications(user_id,title,body,link,event_kind)
   SELECT p.user_id,NEW.title,coalesce(category_label,'Subasta')||' · Nueva subasta en NEXO','/subastas/'||NEW.id,'new_auction'
   FROM public.notification_preferences p WHERE p.new_auctions AND EXISTS(
    SELECT 1 FROM public.push_devices d WHERE d.user_id=p.user_id AND d.active AND d.transport='webpush'
     AND (d.subscription->>'expirationTime' IS NULL OR (d.subscription->>'expirationTime')::numeric>extract(epoch FROM clock_timestamp())*1000));
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER new_auction_notifications AFTER INSERT OR UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.new_auction_notifications();
CREATE OR REPLACE FUNCTION public.enqueue_notification_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.notification_push_outbox(notification_id,device_id,user_id)
 SELECT NEW.id,d.id,NEW.user_id FROM public.push_devices d JOIN public.notification_preferences p ON p.user_id=d.user_id
 WHERE d.user_id=NEW.user_id AND d.active AND d.transport='webpush'
 AND (d.subscription->>'expirationTime' IS NULL OR (d.subscription->>'expirationTime')::numeric>extract(epoch FROM clock_timestamp())*1000)
 AND CASE WHEN NEW.event_kind='new_auction' OR NEW.body LIKE '%Nueva subasta en NEXO%' THEN p.new_auctions ELSE p.activity END
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.claim_notification_push_batch(_limit integer DEFAULT 20)
RETURNS TABLE(queue_id uuid,device_id uuid,subscription jsonb,notification_id uuid,title text,body text,path text,auction_id uuid,category_name text,starting_price numeric,currency text,image_path text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH candidates AS (
 SELECT q.id FROM public.notification_push_outbox q JOIN public.notifications n ON n.id=q.notification_id
 JOIN public.push_devices d ON d.id=q.device_id AND d.user_id=q.user_id AND d.active AND d.transport='webpush'
 JOIN public.notification_preferences p ON p.user_id=q.user_id
 WHERE q.status='pending' AND (d.subscription->>'expirationTime' IS NULL OR (d.subscription->>'expirationTime')::numeric>extract(epoch FROM clock_timestamp())*1000)
 AND CASE WHEN n.event_kind='new_auction' OR n.body LIKE '%Nueva subasta en NEXO%' THEN p.new_auctions AND EXISTS(SELECT 1 FROM public.auctions a WHERE n.link='/subastas/'||a.id AND a.status='active') ELSE p.activity END
 ORDER BY q.created_at LIMIT least(greatest(_limit,1),20) FOR UPDATE OF q SKIP LOCKED
 ), claimed AS (UPDATE public.notification_push_outbox q SET status='sending',claimed_at=now() FROM candidates c WHERE q.id=c.id RETURNING q.*)
 SELECT c.id,d.id,d.subscription,n.id,n.title,n.body,n.link,a.id,cat.name,CASE WHEN a.auction_type='item' THEN a.starting_price ELSE NULL END,a.currency,CASE WHEN a.auction_type='item' AND a.status<>'draft' THEN a.images[1] ELSE NULL END
 FROM claimed c JOIN public.push_devices d ON d.id=c.device_id JOIN public.notifications n ON n.id=c.notification_id LEFT JOIN public.auctions a ON n.link='/subastas/'||a.id LEFT JOIN public.categories cat ON cat.id=a.category_id
$$;
REVOKE ALL ON FUNCTION public.claim_notification_push_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_push_batch(integer) TO service_role;
CREATE FUNCTION public.delete_read_notifications(_id uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE removed_count integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 PERFORM n.id FROM public.notifications n WHERE n.user_id=auth.uid() AND n.read AND (_id IS NULL OR n.id=_id) FOR UPDATE;
 DELETE FROM public.notification_push_outbox q USING public.notifications n WHERE q.notification_id=n.id AND n.user_id=auth.uid() AND n.read AND (_id IS NULL OR n.id=_id);
 DELETE FROM public.notifications n WHERE n.user_id=auth.uid() AND n.read AND (_id IS NULL OR n.id=_id);
 GET DIAGNOSTICS removed_count=ROW_COUNT;
 RETURN removed_count;
END $$;
REVOKE ALL ON FUNCTION public.delete_read_notifications(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_read_notifications(uuid) TO authenticated;
REVOKE DELETE ON public.notifications FROM authenticated;