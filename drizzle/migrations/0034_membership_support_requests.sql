CREATE TABLE public.support_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 5 AND 120),body text NOT NULL CHECK(length(trim(body)) BETWEEN 10 AND 4000),status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),response text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_read ON public.support_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY support_create ON public.support_requests FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='open' AND response IS NULL);
CREATE FUNCTION public.answer_support(_id uuid,_response text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_user uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF length(trim(_response)) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Escribe una respuesta'; END IF;
 UPDATE public.support_requests SET response=trim(_response),status='answered',updated_at=now() WHERE id=_id RETURNING user_id INTO target_user;
 IF target_user IS NULL THEN RAISE EXCEPTION 'Solicitud no disponible'; END IF;
 PERFORM public.notify(target_user,'Respuesta de soporte NEXO','Tu solicitud de soporte tiene una respuesta.','/perfil');
END $$;
REVOKE ALL ON FUNCTION public.answer_support(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.answer_support(uuid,text) TO authenticated;