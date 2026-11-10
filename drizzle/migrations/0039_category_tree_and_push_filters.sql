-- Categorías jerárquicas y filtros de Web Push por categoría.
ALTER TABLE public.categories
  ADD COLUMN parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  ADD COLUMN description text,
  ADD COLUMN icon text,
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX categories_parent_active_sort_idx
  ON public.categories(parent_id, active, sort, name);

-- Conservar los identificadores existentes para no romper subastas publicadas.
UPDATE public.categories SET name = CASE slug
  WHEN 'electronica' THEN 'Tecnología'
  WHEN 'vehiculos' THEN 'Vehículos, transporte y maquinaria'
  WHEN 'hogar' THEN 'Hogar y jardín'
  WHEN 'moda' THEN 'Moda y accesorios'
  WHEN 'coleccionables' THEN 'Arte y coleccionables'
  WHEN 'deportes' THEN 'Deportes y recreación'
  WHEN 'herramientas' THEN 'Industria y herramientas'
  WHEN 'inmuebles' THEN 'Inmuebles y construcción'
  WHEN 'servicios' THEN 'Servicios profesionales y personales'
  WHEN 'otros' THEN 'Otros'
  ELSE name END,
  updated_at = now();

INSERT INTO public.categories(slug,name,sort,icon) VALUES
 ('agricultura','Agricultura y ganadería',10,'tractor'),
 ('salud','Salud y bienestar',11,'heart-pulse'),
 ('educacion','Educación y formación',12,'graduation-cap'),
 ('negocios','Negocios y comercio',13,'briefcase'),
 ('activos-digitales','Activos digitales',14,'wallet')
ON CONFLICT(slug) DO UPDATE SET name=excluded.name, icon=excluded.icon, updated_at=now();

-- Subcategorías iniciales: el administrador puede añadir, renombrar y desactivar sin código.
WITH seed(parent_slug,slug,name,sort) AS (VALUES
 ('vehiculos','autos','Autos y camionetas',1),
 ('vehiculos','motocicletas','Motocicletas',2),
 ('vehiculos','camiones','Camiones y transporte pesado',3),
 ('vehiculos','maquinaria-transporte','Maquinaria de transporte',4),
 ('inmuebles','casas','Casas y apartamentos',1),
 ('inmuebles','terrenos','Terrenos y lotes',2),
 ('inmuebles','locales-comerciales','Locales y oficinas',3),
 ('inmuebles','materiales-construccion','Materiales de construcción',4),
 ('hogar','muebles','Muebles',1),
 ('hogar','electrodomesticos','Electrodomésticos',2),
 ('hogar','jardin','Jardín y exteriores',3),
 ('electronica','telefonos','Teléfonos y tablets',1),
 ('electronica','computadoras','Computadoras',2),
 ('electronica','audio-video','Audio y video',3),
 ('electronica','gaming','Videojuegos y consolas',4),
 ('moda','ropa','Ropa',1),
 ('moda','calzado','Calzado',2),
 ('moda','accesorios','Accesorios',3),
 ('agricultura','maquinaria-agricola','Maquinaria agrícola',1),
 ('agricultura','insumos-agricolas','Insumos y herramientas agrícolas',2),
 ('agricultura','ganaderia','Ganadería y animales de granja',3),
 ('herramientas','maquinaria-industrial','Maquinaria industrial',1),
 ('herramientas','herramientas-industriales','Herramientas industriales',2),
 ('coleccionables','arte-original','Arte y obras originales',1),
 ('coleccionables','antiguedades','Antigüedades y coleccionables',2),
 ('deportes','fitness','Fitness y gimnasio',1),
 ('deportes','deportes-aire-libre','Deportes al aire libre',2),
 ('salud','equipos-medicos','Equipos médicos',1),
 ('salud','cuidado-personal','Cuidado personal',2),
 ('educacion','cursos','Cursos y capacitación',1),
 ('educacion','libros','Libros y material educativo',2),
 ('negocios','equipamiento-comercial','Equipamiento comercial',1),
 ('negocios','inventario-comercial','Inventario y mercancía',2),
 ('activos-digitales','dominios','Dominios y sitios web',1),
 ('activos-digitales','software-licencias','Software y licencias transferibles',2),
 ('servicios','profesionales','Servicios profesionales',1),
 ('servicios','personales','Servicios personales',2),
 ('servicios','reparaciones','Reparaciones y mantenimiento',3),
 ('servicios','transporte-mudanzas','Transporte y mudanzas',4)
)
INSERT INTO public.categories(slug,name,sort,parent_id)
SELECT seed.slug,seed.name,seed.sort,parent.id
FROM seed JOIN public.categories parent ON parent.slug=seed.parent_slug
ON CONFLICT(slug) DO UPDATE SET parent_id=excluded.parent_id,name=excluded.name,sort=excluded.sort,updated_at=now();

COMMENT ON COLUMN public.notification_preferences.categories IS 'IDs de categorías para avisos de nuevas subastas; arreglo vacío significa todas las categorías.';

-- Mantener la selección de categorías como filtro opcional: vacío = todas.
CREATE OR REPLACE FUNCTION public.new_auction_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE event_id uuid; category_label text;
BEGIN
 IF NEW.status='active' THEN
  IF TG_OP='UPDATE' THEN
   IF OLD.status NOT IN ('draft','scheduled') THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.auction_push_events(auction_id) VALUES(NEW.id)
  ON CONFLICT DO NOTHING RETURNING auction_id INTO event_id;
  IF event_id IS NULL THEN RETURN NEW; END IF;
  SELECT c.name INTO category_label FROM public.categories c WHERE c.id=NEW.category_id;
  INSERT INTO public.notifications(user_id,title,body,link,event_kind)
  SELECT p.user_id,NEW.title,coalesce(category_label,'Subasta')||' · Nueva subasta en NEXO',
         '/subastas/'||NEW.id,'new_auction'
  FROM public.notification_preferences p
  WHERE p.new_auctions AND p.user_id<>NEW.seller_id
    AND (cardinality(p.categories)=0 OR NEW.category_id=ANY(p.categories))
    AND EXISTS(SELECT 1 FROM public.push_devices d
      WHERE d.user_id=p.user_id AND d.active AND d.transport='webpush'
        AND (d.subscription->>'expirationTime' IS NULL
          OR (d.subscription->>'expirationTime')::numeric>extract(epoch FROM clock_timestamp())*1000));
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.claim_notification_push_batch(_limit integer DEFAULT 20)
RETURNS TABLE(queue_id uuid,device_id uuid,subscription jsonb,notification_id uuid,title text,body text,path text,auction_id uuid,category_name text,starting_price numeric,currency text,image_path text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH candidates AS (
  SELECT q.id FROM public.notification_push_outbox q
  JOIN public.notifications n ON n.id=q.notification_id
  JOIN public.push_devices d ON d.id=q.device_id AND d.user_id=q.user_id AND d.active AND d.transport='webpush'
  JOIN public.notification_preferences p ON p.user_id=q.user_id
  WHERE ((q.status='pending' AND q.next_attempt_at<=now()) OR (q.status='sending' AND q.claimed_at<now()-interval '5 minutes'))
    AND q.attempts<3
    AND (d.subscription->>'expirationTime' IS NULL OR (d.subscription->>'expirationTime')::numeric>extract(epoch FROM clock_timestamp())*1000)
    AND CASE WHEN n.event_kind='new_auction' OR n.body LIKE '%Nueva subasta en NEXO%'
      THEN p.new_auctions AND EXISTS(
        SELECT 1 FROM public.auctions a
        WHERE n.link='/subastas/'||a.id AND a.status='active'
          AND (cardinality(p.categories)=0 OR a.category_id=ANY(p.categories)))
      ELSE p.activity END
  ORDER BY q.created_at LIMIT least(greatest(_limit,1),20) FOR UPDATE OF q SKIP LOCKED
 ), claimed AS (
  UPDATE public.notification_push_outbox q SET status='sending',claimed_at=now(),attempts=q.attempts+1
  FROM candidates c WHERE q.id=c.id RETURNING q.*
 )
 SELECT c.id,d.id,d.subscription,n.id,n.title,n.body,n.link,a.id,cat.name,
  CASE WHEN a.auction_type='item' AND n.event_kind='new_auction' THEN a.starting_price ELSE NULL END,
  a.currency,
  CASE WHEN a.auction_type='item' AND a.status NOT IN ('draft','cancelled') THEN a.images[1] ELSE NULL END
 FROM claimed c JOIN public.push_devices d ON d.id=c.device_id
 JOIN public.notifications n ON n.id=c.notification_id
 LEFT JOIN public.transactions tx ON n.link='/operaciones/'||tx.id
 LEFT JOIN public.auctions a ON n.link='/subastas/'||a.id OR a.id=tx.auction_id
 LEFT JOIN public.categories cat ON cat.id=a.category_id
$$;
REVOKE ALL ON FUNCTION public.claim_notification_push_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_push_batch(integer) TO service_role;
