ALTER TABLE public.push_devices ADD COLUMN transport text NOT NULL DEFAULT 'fcm' CHECK (transport IN ('fcm','webpush')), ADD COLUMN subscription jsonb;
COMMENT ON COLUMN public.push_devices.token IS 'FCM legacy token or native Web Push endpoint; scoped to owner through RLS';
CREATE OR REPLACE FUNCTION public.claim_web_push_batch(_limit integer DEFAULT 20) RETURNS TABLE(queue_id uuid,device_id uuid,subscription jsonb,auction_id uuid,title text,category_name text,image_path text) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
WITH candidates AS (
 SELECT q.id FROM public.push_outbox q JOIN public.push_devices d ON d.id=q.device_id AND d.active AND d.transport='webpush' AND d.subscription IS NOT NULL JOIN public.notification_preferences p ON p.user_id=q.user_id AND p.new_auctions JOIN public.auctions a ON a.id=q.auction_id AND a.status='active'
 WHERE q.status='pending' AND (cardinality(p.categories)=0 OR a.category_id=ANY(p.categories)) ORDER BY q.created_at LIMIT least(greatest(_limit,1),20) FOR UPDATE OF q SKIP LOCKED
), claimed AS (UPDATE public.push_outbox q SET status='sending',claimed_at=now() FROM candidates c WHERE q.id=c.id RETURNING q.*)
SELECT c.id,d.id,d.subscription,a.id,a.title,coalesce(cat.name,'Subasta'),CASE WHEN a.auction_type='item' THEN a.images[1] ELSE NULL END FROM claimed c JOIN public.push_devices d ON d.id=c.device_id JOIN public.auctions a ON a.id=c.auction_id LEFT JOIN public.categories cat ON cat.id=a.category_id $$;
REVOKE ALL ON FUNCTION public.claim_web_push_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_web_push_batch(integer) TO service_role;
