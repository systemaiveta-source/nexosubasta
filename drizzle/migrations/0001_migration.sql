create or replace function public.close_if_due(_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.auctions where id = _auction_id and status in ('active','scheduled')
             and ((status='active' and ends_at <= clock_timestamp()) or (status='scheduled' and starts_at <= clock_timestamp()))) then
    perform public.process_auctions();
  end if;
end $$;
grant execute on function public.close_if_due(uuid) to anon, authenticated;