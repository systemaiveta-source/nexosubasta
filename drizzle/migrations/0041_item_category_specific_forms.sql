-- Ficha estructurada y específica para artículos; separada de las solicitudes de servicios.
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS item_details jsonb;
ALTER TABLE public.auctions ADD CONSTRAINT auction_item_details_object_check
  CHECK (item_details IS NULL OR (jsonb_typeof(item_details)='object' AND length(item_details::text)<=30000));

CREATE OR REPLACE FUNCTION public.save_item_details(_auction uuid, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE auction_row public.auctions;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(_details)<>'object'
     OR length(_details::text)>30000
     OR length(trim(coalesce(_details->>'categorySlug','')))=0
     OR jsonb_typeof(_details->'values')<>'object' THEN
    RAISE EXCEPTION 'Ficha de artículo no válida';
  END IF;
  SELECT * INTO auction_row FROM public.auctions WHERE id=_auction FOR UPDATE;
  IF auction_row.id IS NULL OR auction_row.seller_id<>auth.uid()
     OR auction_row.auction_type<>'item' OR auction_row.status<>'draft' THEN
    RAISE EXCEPTION 'Solo puedes editar la ficha de tu borrador de artículo';
  END IF;
  UPDATE public.auctions SET item_details=_details WHERE id=_auction;
END $$;
REVOKE ALL ON FUNCTION public.save_item_details(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_item_details(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.item_details_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND NEW.item_details IS DISTINCT FROM OLD.item_details THEN
    RAISE EXCEPTION 'La ficha de un artículo publicado no puede modificarse';
  END IF;
  IF NEW.item_details IS NOT NULL AND NEW.auction_type<>'item' THEN
    RAISE EXCEPTION 'Los detalles de artículo no corresponden a servicios';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER item_details_guard BEFORE INSERT OR UPDATE ON public.auctions
FOR EACH ROW EXECUTE FUNCTION public.item_details_guard();

-- Exponer la ficha únicamente a través de la proyección segura de subastas.
DO $$
DECLARE view_sql text;
BEGIN
  SELECT pg_get_viewdef('public.auctions_safe'::regclass,true) INTO view_sql;
  IF position('a.item_details' in view_sql)=0 THEN
    view_sql:=replace(view_sql,'a.delivery_snapshot','a.delivery_snapshot, a.item_details');
    IF position('a.item_details' in view_sql)=0 THEN
      RAISE EXCEPTION 'No se pudo ampliar auctions_safe sin alterar su proyección';
    END IF;
    EXECUTE 'CREATE OR REPLACE VIEW public.auctions_safe WITH (security_barrier=true) AS '||view_sql;
  END IF;
END $$;
GRANT SELECT(item_details) ON public.auctions TO anon,authenticated;
