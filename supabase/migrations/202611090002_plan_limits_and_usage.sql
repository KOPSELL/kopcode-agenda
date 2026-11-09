-- AgendaKopcode: limites de plano e controle mensal de identidade visual.
-- Execute somente no Supabase do AgendaKopcode (hfxakwkmitmjvmzzyytq).

begin;

create table if not exists public.shop_plan_usage (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  usage_month date not null,
  identity_changes integer not null default 0 check (identity_changes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, usage_month)
);

alter table public.shop_plan_usage enable row level security;
drop policy if exists "Owners view monthly plan usage" on public.shop_plan_usage;
create policy "Owners view monthly plan usage"
on public.shop_plan_usage for select to authenticated
using (exists (
  select 1 from public.barbershops bs
  where bs.id = shop_plan_usage.barbershop_id
    and bs.owner_id = (select auth.uid())
));

create or replace function public.enforce_barber_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text := 'inicio';
  v_status text := 'trialing';
  v_limit integer := 2;
  v_count integer := 0;
  v_trial_ends_at timestamptz;
begin
  if not new.active then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.active is true then
    return new;
  end if;

  select coalesce(ss.plan_code, 'inicio'), coalesce(ss.status, 'trialing'), ss.trial_ends_at
    into v_plan, v_status, v_trial_ends_at
  from public.shop_subscriptions ss
  where ss.barbershop_id = new.barbershop_id
  limit 1;

  v_plan := coalesce(v_plan, 'inicio');
  v_status := coalesce(v_status, 'trialing');
  if v_status <> 'active' and not (v_status = 'trialing' and v_trial_ends_at > now()) then
    v_plan := 'inicio';
  end if;

  v_limit := case v_plan
    when 'premium' then 4
    when 'definitivo' then 2147483647
    else 2
  end;

  select count(*) into v_count
  from public.barbers b
  where b.barbershop_id = new.barbershop_id
    and b.active is true
    and (tg_op = 'INSERT' or b.id <> new.id);

  if v_count >= v_limit then
    raise exception 'Seu plano % permite até % profissionais ativos. Faça upgrade para adicionar outro profissional.', v_plan, case when v_plan = 'definitivo' then 'ilimitado' else v_limit::text end;
  end if;

  return new;
end;
$$;

drop trigger if exists barbers_enforce_plan_limit on public.barbers;
create trigger barbers_enforce_plan_limit
before insert or update of active on public.barbers
for each row execute function public.enforce_barber_plan_limit();

create or replace function public.enforce_shop_identity_monthly_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text := 'inicio';
  v_status text := 'trialing';
  v_limit integer := 2;
  v_month date := date_trunc('month', now())::date;
  v_trial_ends_at timestamptz;
  v_used integer := 0;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.name is not distinct from old.name
     and new.logo_url is not distinct from old.logo_url
     and new.cover_url is not distinct from old.cover_url then
    return new;
  end if;

  select coalesce(ss.plan_code, 'inicio'), coalesce(ss.status, 'trialing'), ss.trial_ends_at
    into v_plan, v_status, v_trial_ends_at
  from public.shop_subscriptions ss
  where ss.barbershop_id = new.id
  limit 1;

  if v_status not in ('active', 'trialing') then
    v_plan := 'inicio';
  end if;

  v_limit := case when v_plan = 'inicio' then 2 else 4 end;

  insert into public.shop_plan_usage (barbershop_id, usage_month, identity_changes)
  values (new.id, v_month, 0)
  on conflict (barbershop_id, usage_month) do nothing;

  select identity_changes into v_used
  from public.shop_plan_usage
  where barbershop_id = new.id and usage_month = v_month
  for update;

  if v_used >= v_limit then
    raise exception 'Seu plano permite % alterações de nome/foto por mês. Você já utilizou esse limite.', v_limit;
  end if;

  update public.shop_plan_usage
  set identity_changes = identity_changes + 1,
      updated_at = now()
  where barbershop_id = new.id and usage_month = v_month;

  return new;
end;
$$;

drop trigger if exists barbershops_identity_monthly_limit on public.barbershops;
create trigger barbershops_identity_monthly_limit
before update of name, logo_url, cover_url on public.barbershops
for each row execute function public.enforce_shop_identity_monthly_limit();

-- Despesas e controle de lucro ficam disponíveis a partir do Premium.
drop policy if exists "Shop owners manage expenses" on public.shop_expenses;
create policy "Shop owners manage expenses"
on public.shop_expenses for all to authenticated
using (
  exists (
    select 1 from public.barbershops bs
    join public.shop_subscriptions ss on ss.barbershop_id = bs.id
    where bs.id = shop_expenses.barbershop_id
      and bs.owner_id = (select auth.uid())
      and ss.plan_code in ('premium', 'definitivo')
      and (ss.status = 'active' or (ss.status = 'trialing' and ss.trial_ends_at > now()))
  )
)
with check (
  exists (
    select 1 from public.barbershops bs
    join public.shop_subscriptions ss on ss.barbershop_id = bs.id
    where bs.id = shop_expenses.barbershop_id
      and bs.owner_id = (select auth.uid())
      and ss.plan_code in ('premium', 'definitivo')
      and ss.status in ('active', 'trialing')
  )
);

commit;
