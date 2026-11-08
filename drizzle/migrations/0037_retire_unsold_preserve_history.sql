ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS retired_at timestamptz;

CREATE OR REPLACE FUNCTION public.delete_unsold_auction(_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  select * into a from public.auctions where id = _auction_id for update;
  if a.id is null then raise exception 'No encontrada'; end if;
  if a.seller_id <> auth.uid() then raise exception 'Solo el subastador puede eliminarla'; end if;
  if a.status <> 'ended_unsold' or a.bid_count > 0 or a.winner_id is not null then
    raise exception 'Solo se eliminan subastas vencidas sin ofertas'; end if;
  if a.selection_pending or exists(select 1 from public.transactions t where t.auction_id = a.id) then
    raise exception 'Esta subasta tiene una operación y no se puede eliminar'; end if;
  delete from public.notification_push_outbox q using public.notifications n
    where q.notification_id = n.id and n.link = '/subastas/' || a.id::text;
  delete from public.notifications where link = '/subastas/' || a.id::text;
  perform set_config('nexo.engine','on', true);
  update public.auctions set retired_at = coalesce(retired_at, now()) where id = a.id;
  perform set_config('nexo.engine','off', true);
  insert into public.auction_events (auction_id, kind, details) values (a.id, 'retired_by_owner', jsonb_build_object('by', auth.uid()));
end $$;
REVOKE EXECUTE ON FUNCTION public.delete_unsold_auction(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_unsold_auction(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_publications() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 RETURN coalesce((SELECT jsonb_agg(v ORDER BY v.created_at DESC) FROM (SELECT s.id,s.title,s.status,s.current_price,s.currency,s.bid_count,s.ends_at,s.auction_type,s.closing_mode,s.winner_id,s.selection_pending,s.extension_pending,a.extension_used,a.republished_from,s.created_at FROM public.auctions_safe s JOIN public.auctions a ON a.id=s.id WHERE s.seller_id=auth.uid() AND a.retired_at IS NULL) v),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.my_publications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_publications() TO authenticated;