ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS method_snapshot jsonb NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS plan_snapshot jsonb NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS proof_values jsonb NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS submission_key uuid DEFAULT gen_random_uuid(), ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS review_reason text, ADD COLUMN IF NOT EXISTS subscription_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS sr_submission_key_unique ON public.subscription_requests(user_id,submission_key);
CREATE INDEX IF NOT EXISTS sr_review_filter ON public.subscription_requests(status,created_at DESC);
CREATE TABLE public.membership_review_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.subscription_requests(id), actor_id uuid NOT NULL, decision text NOT NULL, reason text, proof_values jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.membership_review_events TO authenticated;
GRANT ALL ON public.membership_review_events TO service_role;
ALTER TABLE public.membership_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review event parties" ON public.membership_review_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.subscription_requests r WHERE r.id=request_id AND (r.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
GRANT SELECT ON public.payment_methods TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
GRANT SELECT ON public.subscription_requests TO authenticated;
GRANT ALL ON public.subscription_requests TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.subscription_requests FROM authenticated,anon;
GRANT SELECT ON public.plans TO anon,authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
CREATE OR REPLACE FUNCTION public.manual_method_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE f jsonb; ids text[] := '{}';
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.subscription_requests WHERE payment_method_id=old.id) THEN RAISE EXCEPTION 'Este método tiene pagos asociados. Desactívalo.'; END IF;
  RETURN old;
 END IF;
 IF length(trim(new.name))<2 OR length(new.name)>100 OR length(trim(new.instructions))<5 OR length(new.instructions)>4000 OR new.sort<0 OR new.sort>10000 THEN RAISE EXCEPTION 'Datos del método no válidos'; END IF;
 IF new.details ? 'requirements' THEN
  IF jsonb_typeof(new.details->'requirements')<>'array' OR jsonb_array_length(new.details->'requirements') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Define entre 1 y 12 requisitos'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(new.details->'requirements') LOOP
   IF coalesce(f->>'id','') !~ '^[a-z][a-z0-9_]{0,39}$' OR (f->>'id')=ANY(ids) OR length(coalesce(f->>'label','')) NOT BETWEEN 1 AND 100 OR coalesce(f->>'type','') NOT IN ('text','number','email','url','file') OR jsonb_typeof(f->'required')<>'boolean' THEN RAISE EXCEPTION 'Requisito no válido'; END IF;
   ids:=array_append(ids,f->>'id');
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(new.details->'requirements') f WHERE f->>'required'='true') THEN RAISE EXCEPTION 'Exige un comprobante obligatorio'; END IF;
 END IF;
 IF coalesce(new.details->>'currency','USD') !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Moneda no válida'; END IF;
 IF coalesce(new.details->'data'->>'payment_link','')<>'' AND new.details->'data'->>'payment_link' !~ '^https://[^/@[:space:]]+([/?#]|$)' THEN RAISE EXCEPTION 'Enlace HTTPS no válido'; END IF;
 IF coalesce(new.details->>'qr_path','')<>'' AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='membership-documents' AND name=new.details->>'qr_path' AND (metadata->>'mimetype') IN ('image/png','image/jpeg','image/webp')) THEN RAISE EXCEPTION 'Imagen no válida'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER manual_method_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.manual_method_guard();
CREATE OR REPLACE FUNCTION public.submit_manual_membership(_plan uuid,_method uuid,_values jsonb,_key uuid,_request uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.plans; m public.payment_methods; r public.subscription_requests; snap jsonb; reqs jsonb; f jsonb; v text; rid uuid; country_value text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 IF _key IS NULL OR jsonb_typeof(_values)<>'object' OR octet_length(_values::text)>30000 THEN RAISE EXCEPTION 'Comprobante no válido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 SELECT * INTO r FROM public.subscription_requests WHERE user_id=auth.uid() AND submission_key=_key;
 IF r.id IS NOT NULL AND (_request IS NULL OR r.status='pending') THEN RETURN r.id; END IF;
 SELECT * INTO p FROM public.plans WHERE id=_plan AND active AND price IS NOT NULL;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Plan no disponible'; END IF;
 SELECT * INTO m FROM public.payment_methods WHERE id=_method AND active FOR SHARE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Método no disponible'; END IF;
 IF _request IS NOT NULL THEN
  SELECT * INTO r FROM public.subscription_requests WHERE id=_request AND user_id=auth.uid() FOR UPDATE;
  IF r.id IS NULL OR r.status NOT IN ('rejected','needs_info') OR r.plan_id<>_plan OR r.payment_method_id<>_method THEN RAISE EXCEPTION 'No puedes reenviar esta solicitud'; END IF;
  snap:=r.method_snapshot;
 ELSE
  IF EXISTS(SELECT 1 FROM public.subscription_requests WHERE user_id=auth.uid() AND plan_id=_plan AND status IN ('pending','needs_info')) THEN RAISE EXCEPTION 'Ya tienes una solicitud abierta para este plan. Revisa tu historial.'; END IF;
  snap:=to_jsonb(m);
 END IF;
 IF snap='{}'::jsonb THEN snap:=to_jsonb(m); END IF;
 IF coalesce(snap->'details'->>'currency',p.currency)<>p.currency THEN RAISE EXCEPTION 'El método no admite la moneda del plan'; END IF;
 IF jsonb_array_length(coalesce(snap->'details'->'countries','[]'))>0 THEN
  SELECT country INTO country_value FROM public.profiles WHERE id=auth.uid();
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(snap->'details'->'countries') c WHERE lower(c)=lower(coalesce(country_value,''))) THEN RAISE EXCEPTION 'Método no disponible para tu país de registro'; END IF;
 END IF;
 reqs:=coalesce(snap->'details'->'requirements','[{"id":"reference","label":"Referencia","type":"text","required":true}]'::jsonb);
 FOR f IN SELECT value FROM jsonb_array_elements(reqs) LOOP
  v:=trim(coalesce(_values->>(f->>'id'),''));
  IF f->>'required'='true' AND v='' THEN RAISE EXCEPTION 'Falta el campo obligatorio: %',f->>'label'; END IF;
  IF v='' THEN CONTINUE; END IF;
  IF length(v)>2000 THEN RAISE EXCEPTION 'Campo demasiado largo'; END IF;
  IF f->>'type'='number' AND v !~ '^[0-9]{1,100}$' THEN RAISE EXCEPTION 'Número no válido'; END IF;
  IF f->>'type'='email' AND v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Correo no válido'; END IF;
  IF f->>'type'='url' AND v !~ '^https://[^/@[:space:]]+([/?#]|$)' THEN RAISE EXCEPTION 'URL HTTPS no válida'; END IF;
  IF f->>'type'='file' THEN
   IF v !~ ('^'||auth.uid()::text||'/proof/[a-f0-9-]{36}\.(pdf|png|jpg|webp)$') OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='membership-documents' AND name=v AND (metadata->>'size')::bigint BETWEEN 1 AND 5242880 AND metadata->>'mimetype' IN ('application/pdf','image/png','image/jpeg','image/webp')) THEN RAISE EXCEPTION 'Comprobante privado no válido'; END IF;
  END IF;
 END LOOP;
 IF _request IS NULL THEN
  INSERT INTO public.subscription_requests(user_id,plan_id,payment_method_id,reference,method_snapshot,plan_snapshot,proof_values,submission_key,status)
  VALUES(auth.uid(),p.id,m.id,coalesce(_values->>'reference','Comprobante adjunto'),snap,to_jsonb(p),_values,_key,'pending') RETURNING id INTO rid;
 ELSE
  UPDATE public.subscription_requests SET proof_values=_values,reference=coalesce(_values->>'reference','Comprobante adjunto'),status='pending',submission_key=_key,revision=revision+1,reviewed_by=NULL,reviewed_at=NULL,review_reason=NULL WHERE id=r.id RETURNING id INTO rid;
 END IF;
 INSERT INTO public.membership_review_events(request_id,actor_id,decision,proof_values) VALUES(rid,auth.uid(),'submitted',_values);
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.submit_manual_membership(uuid,uuid,jsonb,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_manual_membership(uuid,uuid,jsonb,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.review_manual_membership(_request uuid,_decision text,_reason text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.subscription_requests; p public.plans; sid uuid; st timestamptz; en timestamptz; months_value integer;
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
  st:=now();
  SELECT greatest(now(),coalesce(max(ends_at),now())) INTO en FROM public.subscriptions WHERE user_id=r.user_id AND plan_id=r.plan_id AND status='active';
  en:=en+make_interval(months=>months_value);
  INSERT INTO public.subscriptions(user_id,plan_id,status,starts_at,ends_at,test_mode,granted_by) VALUES(r.user_id,r.plan_id,'active',st,en,true,auth.uid()) RETURNING id INTO sid;
  INSERT INTO public.user_roles(user_id,role) VALUES(r.user_id,'seller') ON CONFLICT DO NOTHING;
  PERFORM public.apply_referral_commission(r.user_id,r.plan_id);
  PERFORM public.notify(r.user_id,'Membresía activa','Tu comprobante fue aprobado.','/planes');
 ELSE
  PERFORM public.notify(r.user_id,CASE WHEN _decision='rejected' THEN 'Comprobante rechazado' ELSE 'Necesitamos información adicional' END,trim(_reason),'/planes');
 END IF;
 UPDATE public.subscription_requests SET status=_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(_reason),''),subscription_id=sid WHERE id=r.id;
 INSERT INTO public.membership_review_events(request_id,actor_id,decision,reason) VALUES(r.id,auth.uid(),_decision,nullif(trim(_reason),''));
 INSERT INTO public.admin_audit_log(actor_id,action,target,details) VALUES(auth.uid(),'review_manual_membership',r.id::text,jsonb_build_object('decision',_decision,'reason',_reason));
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.review_manual_membership(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_manual_membership(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_review_subscription(_request uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT _approve THEN RAISE EXCEPTION 'Usa la revisión con motivo obligatorio'; END IF; PERFORM public.review_manual_membership(_request,'approved',''); END $$;
CREATE POLICY "membership documents upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='membership-documents' AND (storage.foldername(name))[1]=auth.uid()::text AND ((storage.foldername(name))[2]='proof' OR ((storage.foldername(name))[2]='qr' AND public.has_role(auth.uid(),'admin'))));
CREATE POLICY "membership documents read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='membership-documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.payment_methods m WHERE m.active AND m.details->>'qr_path'=name)));
