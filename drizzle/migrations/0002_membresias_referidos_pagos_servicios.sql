
-- 1. Planes de membresía aprobados: mensual $1, trimestral $5, semestral $10, anual $20
alter table public.plans add column if not exists referral_pct numeric not null default 0;
alter table public.plans add column if not exists months integer not null default 1;
alter table public.plans drop constraint plans_period_check;
alter table public.plans add constraint plans_period_check check (period in ('monthly','quarterly','semiannual','annual'));

delete from public.plans where name in ('Vendedor anual','Comprador plus');
insert into public.plans (name, audience, period, price, currency, max_active_auctions, benefits, referral_pct, months) values
('NEXO Inicio','seller','monthly',1,'USD',3,array['3 subastas activas a la vez','Comisión de referidos: 5%','Soporte estándar'],5,1),
('NEXO Impulso','seller','quarterly',5,'USD',10,array['10 subastas activas a la vez','Comisión de referidos: 10%','Publicidad destacada 1 vez al mes'],10,3),
('NEXO Pro','seller','semiannual',10,'USD',25,array['25 subastas activas a la vez','Comisión de referidos: 15%','Publicidad destacada cada semana','Insignia Pro en tu perfil'],15,6),
('NEXO Élite','seller','annual',20,'USD',null,array['Subastas activas ilimitadas','Comisión de referidos: 20%','Publicidad destacada permanente','Insignia Élite en tu perfil','Atención prioritaria'],20,12);

-- 2. Perfiles: código de referido, patrocinador y moneda preferida
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id);
alter table public.profiles add column if not exists currency text not null default 'USD';

update public.profiles set referral_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)) where referral_code is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as
$fn$
begin
  insert into public.profiles (id, display_name, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  insert into public.user_roles (user_id, role) values (new.id, 'buyer');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end
$fn$;

-- 3. Métodos de pago administrables (el admin agrega/edita los que desee)
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'manual',
  instructions text not null default '',
  details jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.payment_methods to anon, authenticated;
grant all on public.payment_methods to service_role;
alter table public.payment_methods enable row level security;
create policy "pm read" on public.payment_methods for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "pm admin" on public.payment_methods for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.payment_methods (name, kind, instructions, sort) values
('Transferencia bancaria','bank','Transfiere a la cuenta oficial de NEXO y envía tu comprobante como referencia.',1),
('Paypalex Nicaragua','wallet','Envía el pago por Paypalex a la cuenta oficial de NEXO e indica tu correo de registro.',2),
('Poket Nicaragua','wallet','Envía el pago por Poket a la cuenta oficial de NEXO e indica tu correo de registro.',3),
('PayPal','paypal','Envía el pago a la cuenta PayPal oficial de NEXO e indica tu correo de registro.',4),
('Criptomonedas (USDT)','crypto','Envía USDT (red TRC20) a la billetera oficial de NEXO y pega el hash de la transacción.',5),
('Tarjeta (Stripe)','stripe','Pago con tarjeta mediante enlace seguro.',6);

-- 4. Solicitudes de suscripción (el usuario paga por un método y el admin confirma)
create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.plans(id),
  payment_method_id uuid references public.payment_methods(id),
  reference text not null default '',
  status text not null default 'pending',
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert on public.subscription_requests to authenticated;
grant all on public.subscription_requests to service_role;
alter table public.subscription_requests enable row level security;
create policy "sr read" on public.subscription_requests for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "sr insert" on public.subscription_requests for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "sr admin" on public.subscription_requests for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- 5. Billetera de comisiones (no retirable en efectivo)
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null,
  amount numeric not null,
  currency text not null default 'USD',
  ref_user_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "wt read own" on public.wallet_transactions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.wallet_balance(_user uuid)
returns numeric language sql stable security definer set search_path to 'public' as
$fn$ select coalesce(sum(amount),0) from public.wallet_transactions where user_id = _user $fn$;

create or replace function public.apply_referral_commission(_buyer uuid, _plan uuid)
returns void language plpgsql security definer set search_path to 'public' as
$fn$
declare sponsor uuid; pct numeric; price numeric; cur text;
begin
  select referred_by into sponsor from public.profiles where id = _buyer;
  if sponsor is null then return; end if;
  if not public.has_active_seller_sub(sponsor) then return; end if;
  select p.referral_pct, p.price, p.currency into pct, price, cur
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.user_id = sponsor and s.status = 'active' and s.ends_at > now()
  order by s.ends_at desc limit 1;
  if pct is null or price is null or pct <= 0 then return; end if;
  insert into public.wallet_transactions (user_id, kind, amount, currency, ref_user_id, note)
  values (sponsor, 'commission', round(price * pct / 100, 2), cur, _buyer, 'Comisión por membresía de un referido');
  perform public.notify(sponsor, 'Ganaste una comisión', 'Un referido tuyo activó una membresía.', '/perfil');
end
$fn$;

create or replace function public.admin_review_subscription(_request uuid, _approve boolean)
returns void language plpgsql security definer set search_path to 'public' as
$fn$
declare r public.subscription_requests; p public.plans;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Solo administradores'; end if;
  select * into r from public.subscription_requests where id = _request for update;
  if r.id is null then raise exception 'Solicitud no encontrada'; end if;
  if r.status <> 'pending' then raise exception 'La solicitud ya fue revisada'; end if;
  select * into p from public.plans where id = r.plan_id;
  update public.subscription_requests set status = case when _approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now() where id = r.id;
  if _approve then
    insert into public.subscriptions (user_id, plan_id, status, starts_at, ends_at, test_mode, granted_by)
    values (r.user_id, r.plan_id, 'active', now(), now() + make_interval(months => p.months), true, auth.uid());
    insert into public.user_roles (user_id, role) values (r.user_id, 'seller') on conflict do nothing;
    perform public.apply_referral_commission(r.user_id, r.plan_id);
    perform public.notify(r.user_id, 'Membresía activa', 'Tu membresía ' || p.name || ' ya está activa.', '/vendedor');
  else
    perform public.notify(r.user_id, 'Pago no confirmado', 'No pudimos confirmar tu pago de membresía. Contáctanos por Ayuda.', '/planes');
  end if;
end
$fn$;

create or replace function public.pay_membership_with_wallet(_plan uuid, _for_user uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as
$fn$
declare p public.plans; target uuid; bal numeric; sub_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  target := coalesce(_for_user, auth.uid());
  select * into p from public.plans where id = _plan and active;
  if p.id is null then raise exception 'Plan no disponible'; end if;
  bal := public.wallet_balance(auth.uid());
  if bal < p.price then raise exception 'Saldo insuficiente: tienes % y el plan cuesta %', bal, p.price; end if;
  insert into public.wallet_transactions (user_id, kind, amount, currency, ref_user_id, note)
  values (auth.uid(), 'spend_membership', -p.price, p.currency, target, 'Pago de membresía ' || p.name || case when target <> auth.uid() then ' (para un tercero)' else '' end);
  insert into public.subscriptions (user_id, plan_id, status, starts_at, ends_at, test_mode)
  values (target, p.id, 'active', now(), now() + make_interval(months => p.months), true) returning id into sub_id;
  insert into public.user_roles (user_id, role) values (target, 'seller') on conflict do nothing;
  perform public.apply_referral_commission(target, p.id);
  perform public.notify(target, 'Membresía activa', 'Tu membresía ' || p.name || ' ya está activa.', '/vendedor');
  return sub_id;
end
$fn$;

create or replace function public.transfer_credit(_to_code text, _amount numeric)
returns void language plpgsql security definer set search_path to 'public' as
$fn$
declare dest uuid; bal numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Monto no válido'; end if;
  select id into dest from public.profiles where referral_code = upper(trim(_to_code));
  if dest is null then raise exception 'Código de usuario no encontrado'; end if;
  if dest = auth.uid() then raise exception 'No puedes transferirte a ti mismo'; end if;
  bal := public.wallet_balance(auth.uid());
  if bal < _amount then raise exception 'Saldo insuficiente'; end if;
  insert into public.wallet_transactions (user_id, kind, amount, currency, ref_user_id, note)
  values (auth.uid(), 'transfer_out', -_amount, 'USD', dest, 'Transferencia enviada'),
         (dest, 'transfer_in', _amount, 'USD', auth.uid(), 'Transferencia recibida');
  perform public.notify(dest, 'Recibiste crédito', 'Un usuario te transfirió crédito de membresía.', '/perfil');
end
$fn$;

-- 6. Subastas de servicios (inversa: gana la oferta más baja) y duraciones flexibles
alter table public.auctions add column if not exists auction_type text not null default 'item';
alter table public.auctions add column if not exists service_from text;
alter table public.auctions add column if not exists service_to text;
alter table public.auctions add column if not exists duration_minutes integer;

create or replace function public.publish_auction(_auction_id uuid)
returns auctions language plpgsql security definer set search_path to 'public' as
$fn$
declare a public.auctions; s public.platform_settings; p public.auction_private; st timestamptz; en timestamptz;
begin
  select * into a from public.auctions where id = _auction_id for update;
  if a.id is null or a.seller_id <> auth.uid() then raise exception 'Subasta no encontrada'; end if;
  if a.status <> 'draft' then raise exception 'Solo se pueden publicar borradores'; end if;
  if not public.has_role(auth.uid(),'seller') then raise exception 'Tu cuenta no es de vendedor'; end if;
  if not public.has_active_seller_sub(auth.uid()) then raise exception 'Necesitas una membresía activa'; end if;
  if (select account_status from public.profiles where id = auth.uid()) <> 'active' then raise exception 'Cuenta suspendida'; end if;
  if char_length(trim(a.title)) < 5 then raise exception 'El título debe tener al menos 5 caracteres'; end if;
  if char_length(trim(a.description)) < 20 then raise exception 'La descripción debe tener al menos 20 caracteres'; end if;
  select * into s from public.platform_settings where id = 1;
  if a.auction_type = 'service' then
    if a.duration_minutes is null or a.duration_minutes < 1 or a.duration_minutes > s.max_duration_days * 24 * 60 then
      raise exception 'Duración fuera de los límites permitidos'; end if;
  else
    if a.category_id is null then raise exception 'Elige una categoría'; end if;
    if coalesce(array_length(a.images,1),0) < 1 then raise exception 'Añade al menos una fotografía'; end if;
    if a.duration_hours < s.min_duration_hours or a.duration_hours > s.max_duration_days * 24 then
      raise exception 'Duración fuera de los límites permitidos'; end if;
  end if;
  if a.min_increment < s.min_increment then raise exception 'El incremento mínimo es %', s.min_increment; end if;
  select * into p from public.auction_private where auction_id = a.id;
  st := greatest(coalesce(a.starts_at, now()), now());
  en := st + case when a.auction_type = 'service' then make_interval(mins => a.duration_minutes) else make_interval(hours => a.duration_hours) end;
  perform set_config('nexo.engine','on', true);
  update public.auctions set
    status = case when st <= now() + interval '5 seconds' then 'active' else 'scheduled' end,
    starts_at = st, ends_at = en, original_ends_at = en,
    has_reserve = (a.auction_type = 'item' and p.reserve_price is not null), reserve_met = false
  where id = a.id returning * into a;
  perform set_config('nexo.engine','off', true);
  insert into public.auction_events (auction_id, kind, details) values (a.id, 'published', jsonb_build_object('starts_at',st,'ends_at',en));
  return a;
end
$fn$;

create or replace function public.place_bid(_auction_id uuid, _amount numeric, _idempotency_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as
$fn$
declare a public.auctions; existing public.bids; b public.bids; reserve numeric; min_ok numeric; max_ok numeric;
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

  if a.auction_type = 'service' then
    if not public.has_active_seller_sub(auth.uid()) then raise exception 'Necesitas una membresía activa para ofrecer servicios'; end if;
    if a.leader_id = auth.uid() then raise exception 'Ya tienes la oferta más baja'; end if;
    max_ok := case when a.current_price is null then a.starting_price else a.current_price - a.min_increment end;
    if _amount is null or _amount > max_ok then raise exception 'Tu oferta debe ser % o menos', max_ok; end if;
    if _amount <= 0 then raise exception 'Importe no válido'; end if;
  else
    if a.leader_id = auth.uid() then raise exception 'Ya tienes la oferta más alta'; end if;
    min_ok := case when a.current_price is null then a.starting_price else a.current_price + a.min_increment end;
    if _amount is null or _amount < min_ok then raise exception 'La oferta mínima es %', min_ok; end if;
    if _amount > 1000000000 then raise exception 'Importe no válido'; end if;
  end if;

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
    reserve_met = case when a.auction_type = 'service' then false else (reserve is null or b.amount >= reserve) end,
    ends_at = new_end,
    extensions_count = extensions_count + case when new_end <> a.ends_at then 1 else 0 end
  where id = a.id;
  perform set_config('nexo.engine','off', true);

  insert into public.auction_events (auction_id, kind, details)
  values (a.id, 'bid', jsonb_build_object('bid_id', b.id, 'amount', b.amount, 'extended', new_end <> a.ends_at));
  if prev_leader is not null and prev_leader <> auth.uid() then
    perform public.notify(prev_leader, 'Te han superado',
      case when a.auction_type = 'service' then 'Hay una oferta más baja en «' else 'Hay una oferta más alta en «' end || a.title || '».', '/subastas/' || a.id);
  end if;
  return jsonb_build_object('ok', true, 'bid_id', b.id, 'ends_at', new_end, 'extended', new_end <> a.ends_at);
end
$fn$;

-- 7. Más categorías: se permite subastar de todo
insert into public.categories (slug, name, sort) values
('tecnologia','Tecnología',11),
('dominios-web','Dominios y sitios web',12),
('nft-cripto','NFT y cripto',13),
('libros','Libros y revistas',14),
('antiguedades','Antigüedades',15),
('transporte-mudanzas','Transporte y mudanzas',16)
on conflict (slug) do nothing;
