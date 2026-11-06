-- Cancelar una subasta (moderación o vendedor) ya no genera avisos: se elimina la notificación de moderación.
CREATE OR REPLACE FUNCTION public.cancel_auction(_auction_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions; staff boolean := public.is_staff(auth.uid());
begin
  select * into a from public.auctions where id = _auction_id for update;
  if a.id is null then raise exception 'No encontrada'; end if;
  if a.status not in ('scheduled','active') then raise exception 'Esta subasta no se puede cancelar'; end if;
  if not staff and not (a.seller_id = auth.uid() and a.bid_count = 0) then
    raise exception 'Solo puedes cancelar subastas propias sin ofertas'; end if;
  perform set_config('nexo.engine','on', true);
  update public.auctions set status = 'cancelled' where id = a.id;
  perform set_config('nexo.engine','off', true);
  insert into public.auction_events (auction_id, kind, details) values (a.id, 'cancelled', jsonb_build_object('by', auth.uid(), 'reason', _reason));
  if staff then
    insert into public.admin_audit_log (actor_id, action, target, details) values (auth.uid(), 'cancel_auction', a.id::text, jsonb_build_object('reason',_reason));
  end if;
  -- Sin avisos: cancelar o eliminar una subasta no notifica a nadie.
  delete from public.notification_push_outbox q using public.notifications n
    where q.notification_id = n.id and n.link = '/subastas/' || a.id::text;
  delete from public.notifications where link = '/subastas/' || a.id::text;
end $$;

-- El vendedor puede eliminar sus subastas vencidas sin ofertas; se limpian sus avisos.
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
  delete from public.auctions where id = a.id;
end $$;
REVOKE EXECUTE ON FUNCTION public.delete_unsold_auction(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_unsold_auction(uuid) TO authenticated;