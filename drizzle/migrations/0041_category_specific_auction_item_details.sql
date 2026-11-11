-- Structured, public product attributes for category-specific auction forms.
CREATE TABLE IF NOT EXISTS public.auction_item_details (
  auction_id uuid PRIMARY KEY REFERENCES public.auctions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  subcategory_name text NOT NULL CHECK (char_length(subcategory_name) BETWEEN 1 AND 100),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(attributes) = 'object' AND octet_length(attributes::text) <= 12000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_item_details ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.auction_item_details TO authenticated;
GRANT SELECT ON public.auction_item_details TO anon;
GRANT ALL ON public.auction_item_details TO service_role;

CREATE POLICY "public item details for visible auctions"
ON public.auction_item_details FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.id = auction_id
      AND (a.status <> 'draft' OR a.seller_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);

CREATE POLICY "seller saves item details on own drafts"
ON public.auction_item_details FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.id = auction_id AND a.seller_id = auth.uid()
      AND a.status = 'draft' AND a.auction_type = 'item'
      AND a.category_id = category_id
  )
);

CREATE POLICY "seller updates item details on own drafts"
ON public.auction_item_details FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.id = auction_id AND a.seller_id = auth.uid()
      AND a.status = 'draft' AND a.auction_type = 'item'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.id = auction_id AND a.seller_id = auth.uid()
      AND a.status = 'draft' AND a.auction_type = 'item'
      AND a.category_id = category_id
  )
);

CREATE OR REPLACE FUNCTION public.guard_auction_item_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE auction_row public.auctions;
BEGIN
  SELECT * INTO auction_row FROM public.auctions WHERE id = NEW.auction_id;
  IF auction_row.id IS NULL OR auction_row.auction_type <> 'item'
     OR auction_row.category_id IS DISTINCT FROM NEW.category_id THEN
    RAISE EXCEPTION 'Los detalles deben corresponder a la categoría del artículo';
  END IF;
  IF jsonb_typeof(NEW.attributes) <> 'object'
     OR octet_length(NEW.attributes::text) > 12000 THEN
    RAISE EXCEPTION 'Los detalles del artículo no tienen un formato válido';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS guard_auction_item_details ON public.auction_item_details;
CREATE TRIGGER guard_auction_item_details
BEFORE INSERT OR UPDATE ON public.auction_item_details
FOR EACH ROW EXECUTE FUNCTION public.guard_auction_item_details();

COMMENT ON TABLE public.auction_item_details IS
  'Structured category-specific item attributes. Public only with a visible auction; seller writes only while the auction is a draft.';
