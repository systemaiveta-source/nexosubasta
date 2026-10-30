create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_sponsor uuid;
begin
  select id into v_sponsor from public.profiles
   where referral_code = upper(trim(coalesce(new.raw_user_meta_data->>'ref','')));
  insert into public.profiles (id, display_name, referral_code, referred_by)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), v_sponsor);
  insert into public.user_roles (user_id, role) values (new.id, 'buyer');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $function$;

-- Users cannot rewrite their sponsor directly
create or replace function public.guard_referred_by()
 returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.referred_by is distinct from old.referred_by and coalesce(current_setting('nexo.ref_claim', true),'') <> 'on'
     and auth.uid() is not null then
    new.referred_by := old.referred_by;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_referred_by on public.profiles;
create trigger trg_guard_referred_by before update on public.profiles for each row execute function public.guard_referred_by();

-- One-time claim (e.g. Google sign-up), only for new accounts without sponsor or memberships
create or replace function public.claim_referral(_code text)
 returns text language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_sponsor uuid; v_me public.profiles;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_me from public.profiles where id = v_uid;
  if v_me.referred_by is not null then return 'ya_asignado'; end if;
  if v_me.created_at < now() - interval '7 days' then return 'cuenta_antigua'; end if;
  if exists (select 1 from public.subscriptions where user_id = v_uid) then return 'con_membresia'; end if;
  select id into v_sponsor from public.profiles where referral_code = upper(trim(_code));
  if v_sponsor is null then return 'codigo_invalido'; end if;
  if v_sponsor = v_uid then return 'propio'; end if;
  perform set_config('nexo.ref_claim','on',true);
  update public.profiles set referred_by = v_sponsor where id = v_uid;
  return 'ok';
end $$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

create or replace function public.my_referral_community()
 returns table(id uuid, display_name text, joined_at timestamptz, plan_name text, plan_active boolean, ends_at timestamptz, earned numeric, currency text)
 language sql stable security definer set search_path to 'public' as $$
  select p.id, p.display_name, p.created_at,
    s.name, (s.ends_at is not null), s.ends_at,
    coalesce((select sum(w.amount) from public.wallet_transactions w where w.user_id = auth.uid() and w.kind='commission' and w.ref_user_id = p.id),0),
    (select w.currency from public.wallet_transactions w where w.user_id = auth.uid() and w.kind='commission' and w.ref_user_id = p.id limit 1)
  from public.profiles p
  left join lateral (
    select pl.name, su.ends_at from public.subscriptions su join public.plans pl on pl.id = su.plan_id
    where su.user_id = p.id and su.status='active' and su.ends_at > now() order by su.ends_at desc limit 1) s on true
  where p.referred_by = auth.uid()
  order by p.created_at desc
$$;
revoke all on function public.my_referral_community() from public, anon;
grant execute on function public.my_referral_community() to authenticated;