-- AgendaKopcode CRM, fidelidade, catálogo público e planos SaaS
-- Execute SOMENTE no projeto Supabase KOPCODE: hfxakwkmitmjvmzzyytq.

begin;

alter table public.products add column if not exists photo_url text;

create table if not exists public.shop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null unique references public.barbershops(id) on delete cascade,
  plan_code text not null default 'inicio' check (plan_code in ('inicio','premium','definitivo')),
  status text not null default 'trialing' check (status in ('trialing','active','expired','cancelled')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '5 days'),
  current_period_ends_at timestamptz,
  payment_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  full_name text not null,
  phone text not null,
  notes text not null default '',
  preferred_services text[] not null default '{}',
  total_visits integer not null default 0,
  no_show_count integer not null default 0,
  loyalty_points integer not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id, phone),
  unique (id, barbershop_id)
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  customer_id uuid not null,
  appointment_id uuid,
  points integer not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint loyalty_customer_same_shop foreign key (customer_id, barbershop_id)
    references public.crm_customers(id, barbershop_id) on delete cascade
);

alter table public.appointments
  add column if not exists loyalty_points_awarded boolean not null default false;

create index if not exists crm_customers_shop_name_idx on public.crm_customers(barbershop_id, full_name);
create index if not exists loyalty_transactions_customer_idx on public.loyalty_transactions(customer_id, created_at desc);

alter table public.shop_subscriptions enable row level security;
alter table public.crm_customers enable row level security;
alter table public.loyalty_transactions enable row level security;

drop policy if exists "Owners manage own subscription" on public.shop_subscriptions;
create policy "Owners manage own subscription" on public.shop_subscriptions
for all to authenticated using (exists (
  select 1 from public.barbershops b where b.id = shop_subscriptions.barbershop_id and b.owner_id = (select auth.uid())
)) with check (exists (
  select 1 from public.barbershops b where b.id = shop_subscriptions.barbershop_id and b.owner_id = (select auth.uid())
));

drop policy if exists "Owners manage own CRM customers" on public.crm_customers;
create policy "Owners manage own CRM customers" on public.crm_customers
for all to authenticated using (exists (
  select 1 from public.barbershops b where b.id = crm_customers.barbershop_id and b.owner_id = (select auth.uid())
)) with check (exists (
  select 1 from public.barbershops b where b.id = crm_customers.barbershop_id and b.owner_id = (select auth.uid())
));

drop policy if exists "Owners read own loyalty transactions" on public.loyalty_transactions;
create policy "Owners read own loyalty transactions" on public.loyalty_transactions
for select to authenticated using (exists (
  select 1 from public.barbershops b where b.id = loyalty_transactions.barbershop_id and b.owner_id = (select auth.uid())
));

create or replace function public.create_default_shop_trial()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.shop_subscriptions (barbershop_id, plan_code, status, trial_started_at, trial_ends_at)
  values (new.id, 'inicio', 'trialing', now(), now() + interval '5 days')
  on conflict (barbershop_id) do nothing;
  return new;
end;
$$;

drop trigger if exists barbershops_create_default_trial on public.barbershops;
create trigger barbershops_create_default_trial
after insert on public.barbershops
for each row execute function public.create_default_shop_trial();

insert into public.shop_subscriptions (barbershop_id, plan_code, status)
select id, 'inicio', 'trialing' from public.barbershops
on conflict (barbershop_id) do nothing;

create or replace function public.sync_crm_from_appointment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_service_name text;
  v_was_no_show boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_was_no_show := old.status = 'no_show';
  end if;

  select name into v_service_name from public.services
  where id = new.service_id and barbershop_id = new.barbershop_id;

  insert into public.crm_customers (barbershop_id, full_name, phone, preferred_services)
  values (new.barbershop_id, new.client_name, regexp_replace(new.client_phone, '\D', '', 'g'),
          case when v_service_name is null then '{}' else array[v_service_name] end)
  on conflict (barbershop_id, phone) do update
    set full_name = excluded.full_name,
        preferred_services = case
          when v_service_name is null or v_service_name = any(public.crm_customers.preferred_services)
          then public.crm_customers.preferred_services
          else array_append(public.crm_customers.preferred_services, v_service_name)
        end,
        updated_at = now()
  returning id into v_customer_id;

  if new.status = 'completed' and not coalesce(new.loyalty_points_awarded, false) then
    update public.crm_customers set
      total_visits = total_visits + 1,
      loyalty_points = loyalty_points + 1,
      last_visit_at = new.starts_at,
      updated_at = now()
    where id = v_customer_id;
    insert into public.loyalty_transactions (barbershop_id, customer_id, appointment_id, points, description)
    values (new.barbershop_id, v_customer_id, new.id, 1, 'Ponto por atendimento concluído');
    new.loyalty_points_awarded := true;
  elsif new.status = 'no_show' and not v_was_no_show then
    update public.crm_customers set no_show_count = no_show_count + 1, updated_at = now()
    where id = v_customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_sync_crm on public.appointments;
create trigger appointments_sync_crm
before insert or update of status, client_name, client_phone, service_id
on public.appointments for each row execute function public.sync_crm_from_appointment();

-- Importa também o histórico que já existia antes da ativação do CRM.
insert into public.crm_customers (
  barbershop_id, full_name, phone, preferred_services,
  total_visits, no_show_count, loyalty_points, last_visit_at
)
select
  a.barbershop_id,
  (array_agg(a.client_name order by a.starts_at desc))[1],
  regexp_replace(a.client_phone, '\D', '', 'g'),
  coalesce(array_agg(distinct s.name) filter (where s.name is not null), '{}'),
  count(*) filter (where a.status = 'completed')::integer,
  count(*) filter (where a.status = 'no_show')::integer,
  count(*) filter (where a.status = 'completed')::integer,
  max(a.starts_at) filter (where a.status = 'completed')
from public.appointments a
left join public.services s on s.id = a.service_id and s.barbershop_id = a.barbershop_id
where nullif(regexp_replace(a.client_phone, '\D', '', 'g'), '') is not null
group by a.barbershop_id, regexp_replace(a.client_phone, '\D', '', 'g')
on conflict (barbershop_id, phone) do nothing;

insert into public.loyalty_transactions (barbershop_id, customer_id, appointment_id, points, description)
select a.barbershop_id, c.id, a.id, 1, 'Ponto por atendimento concluído (histórico)'
from public.appointments a
join public.crm_customers c
  on c.barbershop_id = a.barbershop_id
 and c.phone = regexp_replace(a.client_phone, '\D', '', 'g')
where a.status = 'completed'
  and not exists (
    select 1 from public.loyalty_transactions lt
    where lt.appointment_id = a.id and lt.barbershop_id = a.barbershop_id
  );

create or replace function public.get_public_products(p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description,
    'price', p.price, 'photo_url', p.photo_url,
    'category', c.name
  ) order by c.name nulls last, p.name), '[]'::jsonb)
  from public.products p
  join public.barbershops b on b.id = p.barbershop_id
  left join public.product_categories c on c.id = p.category_id and c.barbershop_id = p.barbershop_id
  where b.slug = p_slug and p.active = true and p.stock_quantity > 0;
$$;

revoke all on function public.get_public_products(text) from public;
grant execute on function public.get_public_products(text) to anon, authenticated;

create or replace function public.enforce_plan_barber_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_plan text;
  v_status text;
  v_trial_end timestamptz;
  v_limit integer;
  v_count integer;
begin
  if not new.active then return new; end if;
  select s.plan_code, s.status, s.trial_ends_at
    into v_plan, v_status, v_trial_end
  from public.shop_subscriptions s where s.barbershop_id = new.barbershop_id;

  if v_plan is null then
    insert into public.shop_subscriptions (barbershop_id) values (new.barbershop_id)
    on conflict (barbershop_id) do nothing;
    v_plan := 'inicio'; v_status := 'trialing'; v_trial_end := now() + interval '5 days';
  end if;

  if v_status = 'trialing' and v_trial_end <= now() then
    raise exception 'Seu período de teste terminou. Escolha um plano para continuar adicionando profissionais.';
  end if;
  if v_status not in ('trialing','active') then
    raise exception 'Assinatura inativa. Escolha um plano para continuar.';
  end if;

  v_limit := case v_plan when 'inicio' then 2 when 'premium' then 4 else null end;
  if v_limit is not null then
    select count(*) into v_count from public.barbers
    where barbershop_id = new.barbershop_id and active and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
    if v_count >= v_limit then
      raise exception 'O plano % permite até % profissionais ativos. Faça upgrade para adicionar mais.', v_plan, v_limit;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists barbers_enforce_plan_limit on public.barbers;
create trigger barbers_enforce_plan_limit
before insert or update of active, barbershop_id on public.barbers
for each row execute function public.enforce_plan_barber_limit();

do $$
declare v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['crm_customers','shop_subscriptions','loyalty_transactions'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;

commit;
