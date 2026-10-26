
create type public.app_role as enum ('admin','moderator','seller','buyer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','moderator'))
$$;
create policy "own roles or staff" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuario',
  country text,
  city text,
  bio text,
  phone text,
  account_status text not null default 'active' check (account_status in ('active','suspended')),
  created_at timestamptz not null default now()
);
grant update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select (id, display_name, country, city, bio, account_status, created_at) on public.profiles to anon, authenticated;
alter table public.profiles enable row level security;
create policy "profiles public read" on public.profiles for select to anon, authenticated using (true);
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.my_profile()
returns public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.account_status <> old.account_status and not public.has_role(auth.uid(),'admin') then
    new.account_status := old.account_status;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'buyer');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  min_increment numeric(12,2) not null default 1,
  extension_seconds int not null default 60,
  min_duration_hours int not null default 1,
  max_duration_days int not null default 30,
  values_approved boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select on public.platform_settings to anon, authenticated;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "settings read" on public.platform_settings for select to anon, authenticated using (true);
insert into public.platform_settings (id) values (1);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort int not null default 0
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "cat read" on public.categories for select to anon, authenticated using (true);
create policy "cat admin" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.categories (slug,name,sort) values
 ('electronica','Electrónica',1),('vehiculos','Vehículos',2),('hogar','Hogar y jardín',3),
 ('moda','Moda',4),('coleccionables','Coleccionables y arte',5),('deportes','Deportes',6),
 ('herramientas','Herramientas e industria',7),('inmuebles','Inmuebles',8),('servicios','Servicios',9),('otros','Otros',10);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience text not null check (audience in ('seller','buyer')),
  period text not null default 'annual' check (period in ('annual','monthly')),
  price numeric(12,2),
  currency text not null default 'USD',
  max_active_auctions int,
  benefits text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.plans to anon, authenticated;
grant insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy "plans read" on public.plans for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "plans admin" on public.plans for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.plans (name,audience,period,max_active_auctions,benefits) values
 ('Vendedor anual','seller','annual',null,array['Publicar subastas','Panel de vendedor','Centro de operaciones']),
 ('Comprador plus','buyer','annual',null,array['Beneficios por definir']);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  test_mode boolean not null default true,
  granted_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "subs own or admin" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.has_active_seller_sub(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.user_id = _user_id and p.audience = 'seller' and s.status = 'active' and s.starts_at <= now() and s.ends_at > now())
$$;

create table public.admin_audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;
create policy "audit staff read" on public.admin_audit_log for select to authenticated using (public.is_staff(auth.uid()));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif own upd" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif own del" on public.notifications for delete to authenticated using (user_id = auth.uid());
create index on public.notifications (user_id, created_at desc);

create or replace function public.notify(_user uuid, _title text, _body text, _link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id,title,body,link) values (_user,_title,_body,_link)
$$;
revoke execute on function public.notify(uuid,text,text,text) from public, anon, authenticated;

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  title text not null default '',
  description text not null default '',
  category_id uuid references public.categories(id),
  country text,
  city text,
  scope text not null default 'national' check (scope in ('local','national','international')),
  delivery_terms text not null default '',
  images text[] not null default '{}',
  starting_price numeric(12,2) not null default 1 check (starting_price > 0),
  min_increment numeric(12,2) not null default 1 check (min_increment > 0),
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft','scheduled','active','ended_sold','ended_unsold','cancelled')),
  duration_hours int not null default 72,
  starts_at timestamptz,
  ends_at timestamptz,
  original_ends_at timestamptz,
  current_price numeric(12,2),
  bid_count int not null default 0,
  leader_id uuid,
  winner_id uuid,
  has_reserve boolean not null default false,
  reserve_met boolean not null default false,
  extensions_count int not null default 0,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.auctions to anon, authenticated;
grant insert, update, delete on public.auctions to authenticated;
grant all on public.auctions to service_role;
alter table public.auctions enable row level security;
create policy "auctions public" on public.auctions for select to anon, authenticated
  using (status <> 'draft' or seller_id = auth.uid() or public.is_staff(auth.uid()));
create policy "auctions seller insert" on public.auctions for insert to authenticated
  with check (seller_id = auth.uid() and status = 'draft' and public.has_role(auth.uid(),'seller'));
create policy "auctions seller update draft" on public.auctions for update to authenticated
  using (seller_id = auth.uid() and status = 'draft') with check (seller_id = auth.uid() and status = 'draft');
create policy "auctions seller delete draft" on public.auctions for delete to authenticated
  using (seller_id = auth.uid() and status = 'draft');
create index on public.auctions (status, ends_at);
create index on public.auctions (seller_id);

create or replace function public.auctions_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('nexo.engine', true),'') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.current_price := null; new.bid_count := 0; new.leader_id := null; new.winner_id := null;
    new.reserve_met := false; new.has_reserve := false; new.starts_at := null; new.ends_at := null;
    new.original_ends_at := null; new.extensions_count := 0; new.flagged := false;
  else
    new.current_price := old.current_price; new.bid_count := old.bid_count; new.leader_id := old.leader_id;
    new.winner_id := old.winner_id; new.reserve_met := old.reserve_met; new.has_reserve := old.has_reserve;
    new.starts_at := old.starts_at; new.ends_at := old.ends_at; new.original_ends_at := old.original_ends_at;
    new.extensions_count := old.extensions_count; new.flagged := old.flagged; new.status := old.status;
    new.seller_id := old.seller_id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger auctions_guard before insert or update on public.auctions for each row execute function public.auctions_guard();

create table public.auction_private (
  auction_id uuid primary key references public.auctions(id) on delete cascade,
  expected_price numeric(12,2) check (expected_price is null or expected_price > 0),
  reserve_price numeric(12,2) check (reserve_price is null or reserve_price > 0)
);
grant select, insert, update on public.auction_private to authenticated;
grant all on public.auction_private to service_role;
alter table public.auction_private enable row level security;
create policy "private seller read" on public.auction_private for select to authenticated
  using (exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid()));
create policy "private seller insert" on public.auction_private for insert to authenticated
  with check (exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid() and a.status = 'draft'));
create policy "private seller update" on public.auction_private for update to authenticated
  using (exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid() and a.status = 'draft'))
  with check (exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid() and a.status = 'draft'));

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null,
  amount numeric(12,2) not null,
  idempotency_key text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (bidder_id, idempotency_key)
);
grant select (id, auction_id, bidder_id, amount, created_at) on public.bids to anon, authenticated;
grant all on public.bids to service_role;
alter table public.bids enable row level security;
create policy "bids public" on public.bids for select to anon, authenticated using (true);
create index on public.bids (auction_id, amount desc);
create index on public.bids (bidder_id);

create table public.auction_extensions (
  id bigserial primary key,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bid_id uuid not null references public.bids(id),
  old_ends_at timestamptz not null,
  new_ends_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default clock_timestamp()
);
grant select on public.auction_extensions to anon, authenticated;
grant all on public.auction_extensions to service_role;
alter table public.auction_extensions enable row level security;
create policy "ext public" on public.auction_extensions for select to anon, authenticated using (true);

create table public.auction_events (
  id bigserial primary key,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  kind text not null,
  details jsonb,
  created_at timestamptz not null default clock_timestamp()
);
grant select on public.auction_events to authenticated;
grant all on public.auction_events to service_role;
alter table public.auction_events enable row level security;
create policy "events seller or staff" on public.auction_events for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid()));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null unique references public.auctions(id),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','completed','disputed','cancelled')),
  buyer_confirmed boolean not null default false,
  seller_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "tx parties" on public.transactions for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.is_tx_party(_tx uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.transactions where id = _tx and (buyer_id = _user or seller_id = _user))
$$;

create or replace function public.tx_contact(_tx uuid)
returns table (user_id uuid, display_name text, phone text) language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.phone from public.transactions t
  join public.profiles p on p.id = case when t.buyer_id = auth.uid() then t.seller_id else t.buyer_id end
  where t.id = _tx and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  sender_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "msg read" on public.messages for select to authenticated
  using (public.is_tx_party(transaction_id, auth.uid()) or public.is_staff(auth.uid()));
create policy "msg insert" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_tx_party(transaction_id, auth.uid()));

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  opened_by uuid not null,
  reason text not null check (char_length(reason) between 5 and 2000),
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolution text,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select on public.disputes to authenticated;
grant all on public.disputes to service_role;
alter table public.disputes enable row level security;
create policy "disp read" on public.disputes for select to authenticated
  using (public.is_tx_party(transaction_id, auth.uid()) or public.is_staff(auth.uid()));

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  reviewer_id uuid not null,
  reviewee_id uuid not null,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (transaction_id, reviewer_id)
);
grant select on public.reviews to anon, authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews public" on public.reviews for select to anon, authenticated using (true);

create table public.ai_flags (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid references public.auctions(id) on delete cascade,
  severity text not null default 'low' check (severity in ('low','medium','high')),
  reason text not null,
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  reviewed_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.ai_flags to authenticated;
grant all on public.ai_flags to service_role;
alter table public.ai_flags enable row level security;
create policy "flags staff" on public.ai_flags for select to authenticated using (public.is_staff(auth.uid()));

create or replace function public.become_seller()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'seller') on conflict do nothing;
end $$;

create or replace function public.publish_auction(_auction_id uuid)
returns public.auctions language plpgsql security definer set search_path = public as $$
declare a public.auctions; s public.platform_settings; p public.auction_private; st timestamptz; en timestamptz;
begin
  select * into a from public.auctions where id = _auction_id for update;
  if a.id is null or a.seller_id <> auth.uid() then raise exception 'Subasta no encontrada'; end if;
  if a.status <> 'draft' then raise exception 'Solo se pueden publicar borradores'; end if;
  if not public.has_role(auth.uid(),'seller') then raise exception 'Tu cuenta no es de vendedor'; end if;
  if not public.has_active_seller_sub(auth.uid()) then raise exception 'Necesitas una suscripción de vendedor activa'; end if;
  if (select account_status from public.profiles where id = auth.uid()) <> 'active' then raise exception 'Cuenta suspendida'; end if;
  if char_length(trim(a.title)) < 5 then raise exception 'El título debe tener al menos 5 caracteres'; end if;
  if char_length(trim(a.description)) < 20 then raise exception 'La descripción debe tener al menos 20 caracteres'; end if;
  if a.category_id is null then raise exception 'Elige una categoría'; end if;
  if coalesce(array_length(a.images,1),0) < 1 then raise exception 'Añade al menos una fotografía'; end if;
  select * into s from public.platform_settings where id = 1;
  if a.duration_hours < s.min_duration_hours or a.duration_hours > s.max_duration_days * 24 then
    raise exception 'Duración fuera de los límites permitidos'; end if;
  if a.min_increment < s.min_increment then raise exception 'El incremento mínimo es %', s.min_increment; end if;
  select * into p from public.auction_private where auction_id = a.id;
  st := greatest(coalesce(a.starts_at, now()), now());
  en := st + make_interval(hours => a.duration_hours);
  perform set_config('nexo.engine','on', true);
  update public.auctions set
    status = case when st <= now() + interval '5 seconds' then 'active' else 'scheduled' end,
    starts_at = st, ends_at = en, original_ends_at = en,
    has_reserve = (p.reserve_price is not null), reserve_met = false
  where id = a.id returning * into a;
  perform set_config('nexo.engine','off', true);
  insert into public.auction_events (auction_id, kind, details) values (a.id, 'published', jsonb_build_object('starts_at',st,'ends_at',en));
  return a;
end $$;

create or replace function public.set_auction_start(_auction_id uuid, _starts_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.auctions where id = _auction_id and seller_id = auth.uid() and status = 'draft') then
    raise exception 'Subasta no encontrada'; end if;
  perform set_config('nexo.engine','on', true);
  update public.auctions set starts_at = _starts_at where id = _auction_id;
  perform set_config('nexo.engine','off', true);
end $$;

create or replace function public.place_bid(_auction_id uuid, _amount numeric, _idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.auctions; existing public.bids; b public.bids; reserve numeric; min_ok numeric;
  now_ts timestamptz := clock_timestamp(); new_end timestamptz; prev_leader uuid; ext_secs int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para ofertar'; end if;
  if _idempotency_key is null or char_length(_idempotency_key) < 8 then raise exception 'Solicitud inválida'; end if;
  select * into existing from public.bids where bidder_id = auth.uid() and idempotency_key = _idempotency_key;
  if existing.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'bid_id', existing.id);
  end if;
  select * into a from public.auctions where id = _auction_id for update;
  now_ts := clock_timestamp();
  if a.id is null then raise exception 'Subasta no encontrada'; end if;
  if a.status <> 'active' or now_ts < a.starts_at then raise exception 'La subasta no está activa'; end if;
  if now_ts >= a.ends_at then raise exception 'La subasta ya ha cerrado'; end if;
  if a.seller_id = auth.uid() then raise exception 'No puedes ofertar en tu propia subasta'; end if;
  if (select account_status from public.profiles where id = auth.uid()) <> 'active' then raise exception 'Cuenta suspendida'; end if;
  if a.leader_id = auth.uid() then raise exception 'Ya tienes la oferta más alta'; end if;
  min_ok := case when a.current_price is null then a.starting_price else a.current_price + a.min_increment end;
  if _amount is null or _amount < min_ok then raise exception 'La oferta mínima es %', min_ok; end if;
  if _amount > 1000000000 then raise exception 'Importe no válido'; end if;

  insert into public.bids (auction_id, bidder_id, amount, idempotency_key, created_at)
  values (a.id, auth.uid(), round(_amount,2), _idempotency_key, now_ts) returning * into b;

  select reserve_price into reserve from public.auction_private where auction_id = a.id;
  select extension_seconds into ext_secs from public.platform_settings where id = 1;
  prev_leader := a.leader_id;
  new_end := a.ends_at;
  if a.ends_at - now_ts <= make_interval(secs => ext_secs) then
    new_end := a.ends_at + make_interval(secs => ext_secs);
    insert into public.auction_extensions (auction_id, bid_id, old_ends_at, new_ends_at, reason)
    values (a.id, b.id, a.ends_at, new_end, 'Oferta válida en los últimos ' || ext_secs || ' segundos');
  end if;

  perform set_config('nexo.engine','on', true);
  update public.auctions set current_price = b.amount, bid_count = bid_count + 1, leader_id = auth.uid(),
    reserve_met = (reserve is null or b.amount >= reserve), ends_at = new_end,
    extensions_count = extensions_count + case when new_end <> a.ends_at then 1 else 0 end
  where id = a.id;
  perform set_config('nexo.engine','off', true);

  insert into public.auction_events (auction_id, kind, details)
  values (a.id, 'bid', jsonb_build_object('bid_id', b.id, 'amount', b.amount, 'extended', new_end <> a.ends_at));
  if prev_leader is not null and prev_leader <> auth.uid() then
    perform public.notify(prev_leader, 'Te han superado', 'Hay una oferta más alta en «' || a.title || '».', '/subastas/' || a.id);
  end if;
  return jsonb_build_object('ok', true, 'bid_id', b.id, 'ends_at', new_end, 'extended', new_end <> a.ends_at);
end $$;

create or replace function public.process_auctions()
returns int language plpgsql security definer set search_path = public as $$
declare a public.auctions; n int := 0; reserve numeric; sold boolean;
begin
  perform set_config('nexo.engine','on', true);
  update public.auctions set status = 'active' where status = 'scheduled' and starts_at <= clock_timestamp();
  for a in select * from public.auctions where status = 'active' and ends_at <= clock_timestamp()
           for update skip locked loop
    select reserve_price into reserve from public.auction_private where auction_id = a.id;
    sold := a.leader_id is not null and (reserve is null or a.current_price >= reserve);
    update public.auctions set status = case when sold then 'ended_sold' else 'ended_unsold' end,
      winner_id = case when sold then a.leader_id else null end
    where id = a.id and status = 'active';
    insert into public.auction_events (auction_id, kind, details)
      values (a.id, 'closed', jsonb_build_object('sold', sold, 'amount', a.current_price));
    if sold then
      insert into public.transactions (auction_id, buyer_id, seller_id, amount, currency)
      values (a.id, a.leader_id, a.seller_id, a.current_price, a.currency) on conflict (auction_id) do nothing;
      perform public.notify(a.leader_id, '¡Has ganado!', 'Ganaste «' || a.title || '». Coordina el pago y la entrega con el vendedor.', '/operaciones');
      perform public.notify(a.seller_id, 'Subasta vendida', '«' || a.title || '» se adjudicó. Revisa tu centro de operaciones.', '/operaciones');
    else
      perform public.notify(a.seller_id, 'Subasta finalizada sin venta', '«' || a.title || '» terminó sin alcanzar la reserva o sin ofertas.', '/vendedor');
      if a.leader_id is not null then
        perform public.notify(a.leader_id, 'Subasta finalizada sin venta', 'No se alcanzó el precio de reserva en «' || a.title || '».', '/subastas/' || a.id);
      end if;
    end if;
    n := n + 1;
  end loop;
  perform set_config('nexo.engine','off', true);
  return n;
end $$;
revoke execute on function public.process_auctions() from public, anon, authenticated;

create or replace function public.cancel_auction(_auction_id uuid, _reason text)
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
    perform public.notify(a.seller_id, 'Subasta cancelada por moderación', coalesce(_reason,''), '/vendedor');
  end if;
end $$;

create or replace function public.confirm_transaction(_tx uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.transactions;
begin
  select * into t from public.transactions where id = _tx for update;
  if t.id is null or not (t.buyer_id = auth.uid() or t.seller_id = auth.uid()) then raise exception 'No encontrada'; end if;
  if t.status <> 'pending' then raise exception 'La operación no está pendiente'; end if;
  update public.transactions set
    buyer_confirmed = buyer_confirmed or (auth.uid() = t.buyer_id),
    seller_confirmed = seller_confirmed or (auth.uid() = t.seller_id)
  where id = t.id returning * into t;
  if t.buyer_confirmed and t.seller_confirmed then
    update public.transactions set status = 'completed', completed_at = now() where id = t.id;
  end if;
  perform public.notify(case when auth.uid() = t.buyer_id then t.seller_id else t.buyer_id end,
    'Operación confirmada', 'La otra parte confirmó la operación.', '/operaciones/' || t.id);
end $$;

create or replace function public.open_dispute(_tx uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.transactions;
begin
  select * into t from public.transactions where id = _tx for update;
  if t.id is null or not (t.buyer_id = auth.uid() or t.seller_id = auth.uid()) then raise exception 'No encontrada'; end if;
  if t.status not in ('pending','completed') then raise exception 'No se puede abrir una disputa'; end if;
  insert into public.disputes (transaction_id, opened_by, reason) values (t.id, auth.uid(), _reason);
  update public.transactions set status = 'disputed' where id = t.id;
  perform public.notify(case when auth.uid() = t.buyer_id then t.seller_id else t.buyer_id end,
    'Disputa abierta', 'Se abrió una disputa en una de tus operaciones.', '/operaciones/' || t.id);
end $$;

create or replace function public.resolve_dispute(_dispute uuid, _status text, _resolution text, _tx_status text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.disputes; t public.transactions;
begin
  if not public.is_staff(auth.uid()) then raise exception 'No autorizado'; end if;
  if _status not in ('resolved','rejected') or _tx_status not in ('pending','completed','cancelled') then raise exception 'Valor no válido'; end if;
  select * into d from public.disputes where id = _dispute for update;
  if d.id is null or d.status <> 'open' then raise exception 'Disputa no abierta'; end if;
  update public.disputes set status = _status, resolution = _resolution, resolved_by = auth.uid(), resolved_at = now() where id = d.id;
  update public.transactions set status = _tx_status, completed_at = case when _tx_status='completed' then now() else completed_at end
    where id = d.transaction_id returning * into t;
  insert into public.admin_audit_log (actor_id, action, target, details) values (auth.uid(), 'resolve_dispute', d.id::text, jsonb_build_object('status',_status,'tx_status',_tx_status,'resolution',_resolution));
  perform public.notify(t.buyer_id, 'Disputa resuelta', coalesce(_resolution,''), '/operaciones/' || t.id);
  perform public.notify(t.seller_id, 'Disputa resuelta', coalesce(_resolution,''), '/operaciones/' || t.id);
end $$;

create or replace function public.leave_review(_tx uuid, _rating int, _comment text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.transactions;
begin
  select * into t from public.transactions where id = _tx;
  if t.id is null or not (t.buyer_id = auth.uid() or t.seller_id = auth.uid()) then raise exception 'No encontrada'; end if;
  if t.status <> 'completed' then raise exception 'Solo puedes valorar operaciones completadas'; end if;
  insert into public.reviews (transaction_id, reviewer_id, reviewee_id, rating, comment)
  values (t.id, auth.uid(), case when auth.uid() = t.buyer_id then t.seller_id else t.buyer_id end, _rating, nullif(trim(_comment),''));
end $$;

create or replace function public.admin_set_role(_user uuid, _role public.app_role, _grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'No autorizado'; end if;
  if _grant then insert into public.user_roles (user_id, role) values (_user, _role) on conflict do nothing;
  else
    if _role = 'admin' and _user = auth.uid() then raise exception 'No puedes quitarte el rol de administrador'; end if;
    delete from public.user_roles where user_id = _user and role = _role;
  end if;
  insert into public.admin_audit_log (actor_id, action, target, details) values (auth.uid(), case when _grant then 'grant_role' else 'revoke_role' end, _user::text, jsonb_build_object('role',_role));
end $$;

create or replace function public.admin_set_status(_user uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'No autorizado'; end if;
  if _user = auth.uid() then raise exception 'No puedes suspender tu propia cuenta'; end if;
  update public.profiles set account_status = _status where id = _user;
  insert into public.admin_audit_log (actor_id, action, target, details) values (auth.uid(), 'set_status', _user::text, jsonb_build_object('status',_status));
end $$;

create or replace function public.admin_list_users()
returns table (id uuid, display_name text, email text, account_status text, roles text[], created_at timestamptz, seller_sub_until timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'No autorizado'; end if;
  return query
  select p.id, p.display_name, u.email::text, p.account_status,
    coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = p.id), '{}'),
    p.created_at,
    (select max(s.ends_at) from public.subscriptions s join public.plans pl on pl.id = s.plan_id
      where s.user_id = p.id and pl.audience='seller' and s.status='active' and s.ends_at > now())
  from public.profiles p join auth.users u on u.id = p.id order by p.created_at desc limit 500;
end $$;

create or replace function public.admin_grant_subscription(_user uuid, _plan uuid, _months int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'No autorizado'; end if;
  if _months < 1 or _months > 36 then raise exception 'Duración no válida'; end if;
  update public.subscriptions set status = 'cancelled' where user_id = _user and plan_id = _plan and status = 'active';
  insert into public.subscriptions (user_id, plan_id, ends_at, test_mode, granted_by) values (_user, _plan, now() + make_interval(months => _months), true, auth.uid());
  if (select audience from public.plans where id = _plan) = 'seller' then
    insert into public.user_roles (user_id, role) values (_user, 'seller') on conflict do nothing;
  end if;
  insert into public.admin_audit_log (actor_id, action, target, details) values (auth.uid(), 'grant_subscription', _user::text, jsonb_build_object('plan',_plan,'months',_months,'test_mode',true));
  perform public.notify(_user, 'Suscripción activada', 'Tu suscripción está activa (modo de prueba, sin cobro).', '/vendedor');
end $$;

create or replace function public.admin_cancel_subscription(_sub uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'No autorizado'; end if;
  update public.subscriptions set status = 'cancelled' where id = _sub;
  insert into public.admin_audit_log (actor_id, action, target) values (auth.uid(), 'cancel_subscription', _sub::text);
end $$;

create or replace function public.admin_review_flag(_flag uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'No autorizado'; end if;
  if _status not in ('dismissed','actioned') then raise exception 'Valor no válido'; end if;
  update public.ai_flags set status = _status, reviewed_by = auth.uid() where id = _flag;
  insert into public.admin_audit_log (actor_id, action, target, details) values (auth.uid(), 'review_flag', _flag::text, jsonb_build_object('status',_status));
end $$;

create or replace function public.admin_update_settings(_min_increment numeric, _min_hours int, _max_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'No autorizado'; end if;
  if _min_increment <= 0 or _min_hours < 1 or _max_days < 1 then raise exception 'Valores no válidos'; end if;
  update public.platform_settings set min_increment = _min_increment, min_duration_hours = _min_hours, max_duration_days = _max_days, updated_at = now() where id = 1;
  insert into public.admin_audit_log (actor_id, action, details) values (auth.uid(), 'update_settings', jsonb_build_object('min_increment',_min_increment,'min_hours',_min_hours,'max_days',_max_days));
end $$;

create or replace view public.user_reputation with (security_invoker = true) as
  select reviewee_id as user_id, count(*)::int as review_count, round(avg(rating)::numeric, 2) as avg_rating
  from public.reviews group by reviewee_id;
grant select on public.user_reputation to anon, authenticated;

alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.messages;

create policy "auction images read" on storage.objects for select to anon, authenticated using (bucket_id = 'auction-images');
create policy "auction images upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'auction-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "auction images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'auction-images' and (storage.foldername(name))[1] = auth.uid()::text);
