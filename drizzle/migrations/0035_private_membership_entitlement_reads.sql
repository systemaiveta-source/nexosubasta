REVOKE EXECUTE ON FUNCTION public.membership_benefits(uuid) FROM anon,authenticated;
CREATE FUNCTION public.my_membership_benefits() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 RETURN public.membership_benefits(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.my_membership_benefits() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_membership_benefits() TO authenticated;
CREATE FUNCTION public.support_priority(_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR (_user<>auth.uid() AND NOT public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN coalesce((public.membership_benefits(_user)->>'priority_support')::boolean,false);
END $$;
REVOKE ALL ON FUNCTION public.support_priority(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_priority(uuid) TO authenticated;