ALTER TABLE public.plans ADD COLUMN featured_interval text NOT NULL DEFAULT 'none' CHECK(featured_interval IN ('none','monthly','weekly','always'));
ALTER TABLE public.plans ADD COLUMN profile_badge text;
ALTER TABLE public.plans ADD COLUMN priority_support boolean NOT NULL DEFAULT false;
UPDATE public.plans SET featured_interval=CASE months WHEN 3 THEN 'monthly' WHEN 6 THEN 'weekly' WHEN 12 THEN 'always' ELSE 'none' END,profile_badge=CASE months WHEN 6 THEN 'Pro' WHEN 12 THEN 'Élite' ELSE NULL END,priority_support=(months=12);
CREATE OR REPLACE FUNCTION public.membership_benefits(_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT jsonb_build_object('name',p.name,'badge',p.profile_badge,'priority_support',p.priority_support,'featured',CASE p.featured_interval WHEN 'always' THEN true WHEN 'weekly' THEN mod(floor(extract(epoch FROM (now()-s.starts_at))/86400)::integer,7)=0 WHEN 'monthly' THEN now()<s.starts_at+make_interval(months=>((extract(year FROM age(now(),s.starts_at))::integer*12)+extract(month FROM age(now(),s.starts_at))::integer))+interval '24 hours' ELSE false END,'featured_interval',p.featured_interval,'max_active_auctions',p.max_active_auctions,'referral_pct',p.referral_pct,'starts_at',s.starts_at,'ends_at',s.ends_at) FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id WHERE s.user_id=_user AND s.status='active' AND s.starts_at<=now() AND s.ends_at>now() AND p.audience='seller' ORDER BY s.ends_at DESC LIMIT 1),'{}'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.membership_benefits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.membership_benefits(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.public_user_profile(_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',p.id,'display_name',p.display_name,'country',p.country,'city',p.city,'bio',p.bio,'created_at',p.created_at,'membership',public.membership_benefits(p.id),'rating',(SELECT avg(r.rating) FROM public.reviews r WHERE r.reviewee_id=p.id),'review_count',(SELECT count(*) FROM public.reviews r WHERE r.reviewee_id=p.id),'reviews',coalesce((SELECT jsonb_agg(v) FROM (SELECT r.rating,r.comment,r.created_at FROM public.reviews r WHERE r.reviewee_id=p.id ORDER BY r.created_at DESC LIMIT 20) v),'[]'::jsonb)) FROM public.profiles p WHERE p.id=_user AND p.account_status='active'
$$;
REVOKE ALL ON FUNCTION public.public_user_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_user_profile(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.featured_auction_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.id FROM public.auctions a WHERE a.status='active' AND (public.membership_benefits(a.seller_id)->>'featured')::boolean IS TRUE
$$;
REVOKE ALL ON FUNCTION public.featured_auction_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.featured_auction_ids() TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.my_referral_community() RETURNS TABLE(id uuid,display_name text,joined_at timestamptz,plan_name text,plan_active boolean,ends_at timestamptz,earned numeric,currency text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,p.display_name,p.created_at,s.name,(s.ends_at IS NOT NULL),s.ends_at,coalesce((SELECT sum(w.amount) FROM public.wallet_transactions w WHERE w.user_id=auth.uid() AND w.kind='commission' AND w.ref_user_id=p.id),0),(SELECT w.currency FROM public.wallet_transactions w WHERE w.user_id=auth.uid() AND w.kind='commission' AND w.ref_user_id=p.id LIMIT 1) FROM public.profiles p LEFT JOIN LATERAL (SELECT pl.name,su.ends_at FROM public.subscriptions su JOIN public.plans pl ON pl.id=su.plan_id WHERE su.user_id=p.id AND su.status='active' AND su.starts_at<=now() AND su.ends_at>now() ORDER BY su.ends_at DESC LIMIT 1) s ON true WHERE p.referred_by=auth.uid() ORDER BY p.created_at DESC
$$;
ALTER TABLE public.notification_push_outbox ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.notification_push_outbox ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE OR REPLACE FUNCTION public.claim_notification_push_batch(_limit integer DEFAULT 20) RETURNS TABLE(queue_id uuid,device_id uuid,subscription jsonb,notification_id uuid,title text,body text,path text,auction_id uuid,category_name text,starting_price numeric,currency text,image_path text) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH candidates AS (
 SELECT q.id FROM public.notification_push_outbox q JOIN public.notifications n ON n.id=q.notification_id JOIN public.push_devices d ON d.id=q.device_id AND d.user_id=q.user_id AND d.active AND d.transport='webpush' JOIN public.notification_preferences p ON p.user_id=q.user_id
 WHERE ((q.status='pending' AND q.next_attempt_at<=now()) OR (q.status='sending' AND q.claimed_at<now()-interval '5 minutes')) AND q.attempts<3 AND (d.subscription->>'expirationTime' IS NULL OR (d.subscription->>'expirationTime')::numeric>extract(epoch FROM clock_timestamp())*1000)
 AND CASE WHEN n.event_kind='new_auction' OR n.body LIKE '%Nueva subasta en NEXO%' THEN p.new_auctions AND EXISTS(SELECT 1 FROM public.auctions a WHERE n.link='/subastas/'||a.id AND a.status='active') ELSE p.activity END
 ORDER BY q.created_at LIMIT least(greatest(_limit,1),20) FOR UPDATE OF q SKIP LOCKED
 ), claimed AS (UPDATE public.notification_push_outbox q SET status='sending',claimed_at=now(),attempts=q.attempts+1 FROM candidates c WHERE q.id=c.id RETURNING q.*)
 SELECT c.id,d.id,d.subscription,n.id,n.title,n.body,n.link,a.id,cat.name,CASE WHEN a.auction_type='item' AND n.event_kind='new_auction' THEN a.starting_price ELSE NULL END,a.currency,CASE WHEN a.auction_type='item' AND a.status NOT IN ('draft','cancelled') THEN a.images[1] ELSE NULL END FROM claimed c JOIN public.push_devices d ON d.id=c.device_id JOIN public.notifications n ON n.id=c.notification_id LEFT JOIN public.transactions tx ON n.link='/operaciones/'||tx.id LEFT JOIN public.auctions a ON n.link='/subastas/'||a.id OR a.id=tx.auction_id LEFT JOIN public.categories cat ON cat.id=a.category_id
$$;
REVOKE ALL ON FUNCTION public.claim_notification_push_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_push_batch(integer) TO service_role;