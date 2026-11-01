-- AgendaKopcode: produtos, estoque, vendas, despesas e comissões por profissional
-- Execute SOMENTE no Supabase exclusivo do AgendaKopcode: hfxakwkmitmjvmzzyytq.
-- Não altera nem consulta os projetos Supabase dos outros sistemas.

begin;

alter table public.barbers
  add column if not exists commission_percent numeric(5,2) not null default 0;

alter table public.barbers
  drop constraint if exists barbers_commission_percent_range;
alter table public.barbers
  add constraint barbers_commission_percent_range
  check (commission_percent >= 0 and commission_percent <= 100);

-- Congela o valor do serviço no momento da reserva para não reescrever o histórico
-- financeiro quando o preço do serviço for alterado futuramente.
alter table public.appointments
  add column if not exists price_at_booking numeric(10,2);

create or replace function public.set_appointment_price_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.price_at_booking is null then
    select s.price into new.price_at_booking
    from public.services s
    where s.id = new.service_id
      and s.barbershop_id = new.barbershop_id;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_set_price_snapshot on public.appointments;
create trigger appointments_set_price_snapshot
before insert on public.appointments
for each row execute function public.set_appointment_price_snapshot();

update public.appointments a
set price_at_booking = s.price
from public.services s
where a.service_id = s.id
  and a.barbershop_id = s.barbershop_id
  and a.price_at_booking is null;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (barbershop_id, name),
  unique (id, barbershop_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  category_id uuid,
  name text not null,
  description text,
  sku text,
  price numeric(10,2) not null default 0 check (price >= 0),
  cost_price numeric(10,2) not null default 0 check (cost_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, barbershop_id),
  constraint products_category_same_shop
    foreign key (category_id, barbershop_id)
    references public.product_categories(id, barbershop_id)
);

create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  cost_at_sale numeric(10,2) not null default 0 check (cost_at_sale >= 0),
  total numeric(10,2) generated always as (quantity * unit_price) stored,
  sold_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint product_sales_product_same_shop
    foreign key (product_id, barbershop_id)
    references public.products(id, barbershop_id)
);

alter table public.product_sales
  add column if not exists cost_at_sale numeric(10,2) not null default 0;

create table if not exists public.shop_expenses (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  description text not null,
  category text not null default 'Geral',
  amount numeric(10,2) not null check (amount > 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists product_categories_shop_idx on public.product_categories(barbershop_id);
create index if not exists products_shop_idx on public.products(barbershop_id, active);
create index if not exists product_sales_shop_date_idx on public.product_sales(barbershop_id, created_at desc);
create index if not exists shop_expenses_shop_date_idx on public.shop_expenses(barbershop_id, expense_date desc);

-- A baixa de estoque acontece no banco, na mesma transação da venda.
create or replace function public.apply_product_sale_stock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  select * into v_product
  from public.products
  where id = new.product_id
    and barbershop_id = new.barbershop_id
  for update;

  if not found or not v_product.active then
    raise exception 'Produto não encontrado ou inativo nesta barbearia.';
  end if;

  if v_product.stock_quantity < new.quantity then
    raise exception 'Estoque insuficiente para concluir esta venda.';
  end if;

  new.product_name := v_product.name;
  new.unit_price := v_product.price;
  new.cost_at_sale := v_product.cost_price;

  update public.products
  set stock_quantity = stock_quantity - new.quantity,
      updated_at = now()
  where id = v_product.id
    and barbershop_id = new.barbershop_id;

  return new;
end;
$$;

drop trigger if exists product_sales_apply_stock on public.product_sales;
create trigger product_sales_apply_stock
before insert on public.product_sales
for each row execute function public.apply_product_sale_stock();

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_sales enable row level security;
alter table public.shop_expenses enable row level security;

drop policy if exists "Shop owners manage product categories" on public.product_categories;
create policy "Shop owners manage product categories"
on public.product_categories for all to authenticated
using (exists (
  select 1 from public.barbershops bs
  where bs.id = product_categories.barbershop_id
    and bs.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.barbershops bs
  where bs.id = product_categories.barbershop_id
    and bs.owner_id = (select auth.uid())
));

drop policy if exists "Shop owners manage products" on public.products;
create policy "Shop owners manage products"
on public.products for all to authenticated
using (exists (
  select 1 from public.barbershops bs
  where bs.id = products.barbershop_id
    and bs.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.barbershops bs
  where bs.id = products.barbershop_id
    and bs.owner_id = (select auth.uid())
));

drop policy if exists "Shop owners manage product sales" on public.product_sales;
create policy "Shop owners manage product sales"
on public.product_sales for all to authenticated
using (exists (
  select 1 from public.barbershops bs
  where bs.id = product_sales.barbershop_id
    and bs.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.barbershops bs
  where bs.id = product_sales.barbershop_id
    and bs.owner_id = (select auth.uid())
));

drop policy if exists "Shop owners manage expenses" on public.shop_expenses;
create policy "Shop owners manage expenses"
on public.shop_expenses for all to authenticated
using (exists (
  select 1 from public.barbershops bs
  where bs.id = shop_expenses.barbershop_id
    and bs.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.barbershops bs
  where bs.id = shop_expenses.barbershop_id
    and bs.owner_id = (select auth.uid())
));


-- Sincroniza estoque, categorias, vendas e despesas entre os dispositivos da mesma barbearia.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['product_categories','products','product_sales','shop_expenses'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;

commit;
