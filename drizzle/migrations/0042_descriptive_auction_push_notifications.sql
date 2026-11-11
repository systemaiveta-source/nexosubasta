-- Make community auction alerts useful on the device lock screen.
-- Keep the existing opt-in audience, event deduplication and queue semantics intact.
CREATE OR REPLACE FUNCTION public.new_auction_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  event_id uuid;
  category_label text;
  item_description text;
BEGIN
  IF NEW.status='active' AND (TG_OP='INSERT' OR OLD.status IN ('draft','scheduled')) THEN
    INSERT INTO public.auction_push_events(auction_id)
    VALUES(NEW.id)
    ON CONFLICT DO NOTHING
    RETURNING auction_id INTO event_id;

    IF event_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT c.name INTO category_label
    FROM public.categories c
    WHERE c.id=NEW.category_id;

    item_description := left(
      regexp_replace(
        coalesce(nullif(trim(NEW.description),''),'Artículo disponible para ofertar'),
        '[[:space:]]+',
        ' ',
        'g'
      ),
      180
    );

    INSERT INTO public.notifications(user_id,title,body,link,event_kind)
    SELECT
      p.user_id,
      NEW.title,
      coalesce(category_label,'Artículo') || ' · Nuevo artículo en subasta: ' || item_description,
      '/subastas/' || NEW.id,
      'new_auction'
    FROM public.notification_preferences p
    WHERE p.new_auctions
      AND EXISTS (
        SELECT 1
        FROM public.push_devices d
        WHERE d.user_id=p.user_id
          AND d.active
          AND d.transport='webpush'
          AND (
            d.subscription->>'expirationTime' IS NULL
            OR (d.subscription->>'expirationTime')::numeric >
              extract(epoch FROM clock_timestamp())*1000
          )
      );
  END IF;

  RETURN NEW;
END
$$;

COMMENT ON FUNCTION public.new_auction_notifications() IS
  'Sends one opt-in community push per newly published auction with category and a bounded public item description; the push worker adds the public thumbnail.';
