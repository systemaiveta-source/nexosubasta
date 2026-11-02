DROP POLICY IF EXISTS "settings read" ON public.platform_settings;
CREATE POLICY "settings read" ON public.platform_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE SELECT ON public.platform_settings FROM anon;