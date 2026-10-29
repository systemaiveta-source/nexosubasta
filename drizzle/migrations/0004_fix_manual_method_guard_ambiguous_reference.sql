CREATE OR REPLACE FUNCTION public.manual_method_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE requirement_value jsonb; ids text[] := '{}';
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.subscription_requests AS request_row WHERE request_row.payment_method_id=old.id) THEN RAISE EXCEPTION 'Este método tiene pagos asociados. Desactívalo.'; END IF;
  RETURN old;
 END IF;
 IF length(trim(new.name))<2 OR length(new.name)>100 OR length(trim(new.instructions))<5 OR length(new.instructions)>4000 OR new.sort<0 OR new.sort>10000 THEN RAISE EXCEPTION 'Datos del método no válidos'; END IF;
 IF new.details ? 'requirements' THEN
  IF jsonb_typeof(new.details->'requirements')<>'array' OR jsonb_array_length(new.details->'requirements') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Define entre 1 y 12 requisitos'; END IF;
  FOR requirement_value IN SELECT requirement_row.value FROM jsonb_array_elements(new.details->'requirements') AS requirement_row(value) LOOP
   IF coalesce(requirement_value->>'id','') !~ '^[a-z][a-z0-9_]{0,39}$' OR (requirement_value->>'id')=ANY(ids) OR length(coalesce(requirement_value->>'label','')) NOT BETWEEN 1 AND 100 OR coalesce(requirement_value->>'type','') NOT IN ('text','number','email','url','file') OR jsonb_typeof(requirement_value->'required')<>'boolean' THEN RAISE EXCEPTION 'Requisito no válido'; END IF;
   ids:=array_append(ids,requirement_value->>'id');
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(new.details->'requirements') AS required_row(value) WHERE required_row.value->>'required'='true') THEN RAISE EXCEPTION 'Exige un comprobante obligatorio'; END IF;
 END IF;
 IF coalesce(new.details->>'currency','USD') !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Moneda no válida'; END IF;
 IF coalesce(new.details->'data'->>'payment_link','')<>'' AND new.details->'data'->>'payment_link' !~ '^https://[^/@[:space:]]+([/?#]|$)' THEN RAISE EXCEPTION 'Enlace HTTPS no válido'; END IF;
 IF coalesce(new.details->>'qr_path','')<>'' AND NOT EXISTS(SELECT 1 FROM storage.objects AS stored_file WHERE stored_file.bucket_id='membership-documents' AND stored_file.name=new.details->>'qr_path' AND (stored_file.metadata->>'mimetype') IN ('image/png','image/jpeg','image/webp')) THEN RAISE EXCEPTION 'Imagen no válida'; END IF;
 RETURN new;
END $$;