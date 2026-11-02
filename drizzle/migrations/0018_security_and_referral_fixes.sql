-- 1) Phones and private profile fields: column-level read access only for public fields
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, country, city, bio, created_at, currency) ON public.profiles TO anon, authenticated;
GRANT SELECT (referral_code) ON public.profiles TO authenticated;

-- 2) Membership documents: bind the QR exception to the object path (was comparing the method to itself)
DROP POLICY IF EXISTS "membership documents read" ON storage.objects;
CREATE POLICY "membership documents read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'membership-documents' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.payment_methods m WHERE m.active AND (m.details ->> 'qr_path') = objects.name)
  )
);

-- 3) Auction images: only owner, admins, or images of non-draft auctions
CREATE OR REPLACE FUNCTION public.auction_image_readable(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.auctions a WHERE a.status <> 'draft' AND _name = ANY(a.images))
$$;
REVOKE ALL ON FUNCTION public.auction_image_readable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auction_image_readable(text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "auction images read" ON storage.objects;
CREATE POLICY "auction images read" ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'auction-images' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.auction_image_readable(name)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 4) Auction extensions: only for published auctions
DROP POLICY IF EXISTS "ext public" ON public.auction_extensions;
CREATE POLICY "ext public" ON public.auction_extensions FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.auctions a WHERE a.id = auction_extensions.auction_id AND a.status <> 'draft'));

-- 5) Referral commissions: base = amount the referred user paid, pct = sponsor plan, idempotent per subscription
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS source_subscription_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_commission_once ON public.wallet_transactions(source_subscription_id) WHERE kind = 'commission' AND source_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_referral_commission_paid(_buyer uuid, _amount numeric, _currency text, _subscription uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sponsor uuid; pct numeric; commission numeric;
BEGIN
  IF _subscription IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = _subscription AND s.granted_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subscription_requests r WHERE r.subscription_id = s.id AND r.status = 'approved')) THEN RETURN 0; END IF;
  SELECT referred_by INTO sponsor FROM public.profiles WHERE id = _buyer;
  IF sponsor IS NULL OR sponsor = _buyer THEN RETURN 0; END IF;
  IF NOT public.has_active_seller_sub(sponsor) THEN RETURN 0; END IF;
  SELECT p.referral_pct INTO pct FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
   WHERE s.user_id = sponsor AND s.status = 'active' AND s.ends_at > now() AND s.starts_at <= now()
   ORDER BY p.referral_pct DESC LIMIT 1;
  IF pct IS NULL OR pct <= 0 THEN RETURN 0; END IF;
  commission := round(_amount * pct / 100, 2);
  INSERT INTO public.wallet_transactions (user_id, kind, amount, currency, ref_user_id, note, source_subscription_id)
  VALUES (sponsor, 'commission', commission, _currency, _buyer, 'Comisión por membresía de un referido', _subscription)
  ON CONFLICT (source_subscription_id) WHERE kind = 'commission' AND source_subscription_id IS NOT NULL DO NOTHING;
  IF FOUND THEN PERFORM public.notify(sponsor, 'Ganaste una comisión', 'Un referido tuyo activó una membresía.', '/perfil'); END IF;
  RETURN commission;
END $$;
REVOKE ALL ON FUNCTION public.apply_referral_commission_paid(uuid, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_referral_commission(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Legacy entry point: never callable by clients; base is the purchased plan price
CREATE OR REPLACE FUNCTION public.apply_referral_commission(_buyer uuid, _plan uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Usa apply_referral_commission_paid con la suscripción pagada';
END $$;
REVOKE ALL ON FUNCTION public.apply_referral_commission(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pay_membership_with_wallet(_plan uuid, _for_user uuid DEFAULT NULL::uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.plans; target uuid; bal numeric; sub_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  target := coalesce(_for_user, auth.uid());
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 7));
  select * into p from public.plans where id = _plan and active;
  if p.id is null or p.price is null then raise exception 'Plan no disponible'; end if;
  bal := public.wallet_balance(auth.uid());
  if bal < p.price then raise exception 'Saldo insuficiente: tienes % y el plan cuesta %', bal, p.price; end if;
  insert into public.wallet_transactions (user_id, kind, amount, currency, ref_user_id, note)
  values (auth.uid(), 'spend_membership', -p.price, p.currency, target, 'Pago de membresía ' || p.name || case when target <> auth.uid() then ' (para un tercero)' else '' end);
  insert into public.subscriptions (user_id, plan_id, status, starts_at, ends_at, test_mode)
  values (target, p.id, 'active', now(), now() + make_interval(months => p.months), true) returning id into sub_id;
  insert into public.user_roles (user_id, role) values (target, 'seller') on conflict do nothing;
  perform public.apply_referral_commission_paid(target, p.price, p.currency, sub_id);
  perform public.notify(target, 'Membresía activa', 'Tu membresía ' || p.name || ' ya está activa.', '/vendedor');
  return sub_id;
end $$;

CREATE OR REPLACE FUNCTION public.review_manual_membership(_request uuid, _decision text, _reason text DEFAULT ''::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE r public.subscription_requests; p public.plans; sid uuid; st timestamptz; en timestamptz; months_value integer; paid numeric; paid_cur text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF _decision NOT IN ('approved','rejected','needs_info') OR length(coalesce(_reason,''))>2000 THEN RAISE EXCEPTION 'Decisión no válida'; END IF;
 IF _decision<>'approved' AND length(trim(coalesce(_reason,'')))<5 THEN RAISE EXCEPTION 'Indica un motivo de al menos 5 caracteres'; END IF;
 SELECT * INTO r FROM public.subscription_requests WHERE id=_request FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'La solicitud ya fue revisada'; END IF;
 IF _decision='approved' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(r.user_id::text,1));
  SELECT * INTO p FROM public.plans WHERE id=r.plan_id;
  months_value:=coalesce((r.plan_snapshot->>'months')::integer,p.months);
  IF months_value NOT BETWEEN 1 AND 36 THEN RAISE EXCEPTION 'Duración no válida'; END IF;
  paid:=coalesce((r.plan_snapshot->>'price')::numeric,p.price);
  paid_cur:=coalesce(r.plan_snapshot->>'currency',p.currency);
  st:=now();
  SELECT greatest(now(),coalesce(max(ends_at),now())) INTO en FROM public.subscriptions WHERE user_id=r.user_id AND plan_id=r.plan_id AND status='active';
  en:=en+make_interval(months=>months_value);
  INSERT INTO public.subscriptions(user_id,plan_id,status,starts_at,ends_at,test_mode,granted_by) VALUES(r.user_id,r.plan_id,'active',st,en,true,auth.uid()) RETURNING id INTO sid;
  INSERT INTO public.user_roles(user_id,role) VALUES(r.user_id,'seller') ON CONFLICT DO NOTHING;
  UPDATE public.subscription_requests SET status='approved',subscription_id=sid WHERE id=r.id;
  PERFORM public.apply_referral_commission_paid(r.user_id,paid,paid_cur,sid);
  PERFORM public.notify(r.user_id,'Membresía activa','Tu comprobante fue aprobado.','/planes');
 ELSE
  PERFORM public.notify(r.user_id,CASE WHEN _decision='rejected' THEN 'Comprobante rechazado' ELSE 'Necesitamos información adicional' END,trim(_reason),'/planes');
 END IF;
 UPDATE public.subscription_requests SET status=_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(_reason),''),subscription_id=sid WHERE id=r.id;
 INSERT INTO public.membership_review_events(request_id,actor_id,decision,reason) VALUES(r.id,auth.uid(),_decision,nullif(trim(_reason),''));
 INSERT INTO public.admin_audit_log(actor_id,action,target,details) VALUES(auth.uid(),'review_manual_membership',r.id::text,jsonb_build_object('decision',_decision,'reason',_reason));
 RETURN sid;
END $function$;