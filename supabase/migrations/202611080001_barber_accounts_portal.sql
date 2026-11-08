-- AgendaKopcode: acesso individual e painel restrito para barbeiros comissionados.
-- Execute no SQL Editor do projeto hfxakwkmitmjvmzzyytq.

begin;

alter table public.barbers
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists notifications_enabled boolean not null default true;

create unique index if not exists barbers_user_id_unique
  on public.barbers(user_id) where user_id is not null;

create index if not exists barbers_user_shop_idx
  on public.barbers(barbershop_id, user_id) where user_id is not null;

-- Identifica o barbeiro autenticado sem confiar em IDs enviados pelo navegador.
create or replace function public.current_user_barber_id(p_barbershop_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select b.id
  from public.barbers b
  where b.barbershop_id = p_barbershop_id
    and b.user_id = (select auth.uid())
    and b.active = true
  limit 1;
$$;

create or replace function public.is_current_user_assigned_barber(
  p_barbershop_id uuid,
  p_barber_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.barbers b
    where b.id = p_barber_id
      and b.barbershop_id = p_barbershop_id
      and b.user_id = (select auth.uid())
      and b.active = true
  );
$$;

grant execute on function public.current_user_barber_id(uuid) to authenticated;
grant execute on function public.is_current_user_assigned_barber(uuid, uuid) to authenticated;

alter table public.barbershops enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

drop policy if exists barbers_read_own_profile on public.barbers;
create policy barbers_read_own_profile
on public.barbers for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists barbershops_read_assigned_barber on public.barbershops;
create policy barbershops_read_assigned_barber
on public.barbershops for select to authenticated
using (public.current_user_barber_id(id) is not null);

drop policy if exists services_read_assigned_barber on public.services;
create policy services_read_assigned_barber
on public.services for select to authenticated
using (public.current_user_barber_id(barbershop_id) is not null);

-- Restrições adicionais impedem que políticas permissivas antigas exponham
-- profissionais ou serviços de colegas/outras barbearias.
drop policy if exists barbers_isolation_select on public.barbers;
create policy barbers_isolation_select
on public.barbers as restrictive
for select to authenticated
using (
  public.has_shop_role(barbershop_id, array['owner','admin']::text[])
  or user_id = (select auth.uid())
);

drop policy if exists barbershops_isolation_select on public.barbershops;
create policy barbershops_isolation_select
on public.barbershops as restrictive
for select to authenticated
using (
  public.has_shop_role(id, array['owner','admin']::text[])
  or public.current_user_barber_id(id) is not null
);

drop policy if exists services_isolation_select on public.services;
create policy services_isolation_select
on public.services as restrictive
for select to authenticated
using (
  public.has_shop_role(barbershop_id, array['owner','admin']::text[])
  or public.current_user_barber_id(barbershop_id) is not null
);

-- A política restritiva de appointments criada na etapa anterior já limita
-- a leitura a proprietário/admin ou ao barbeiro vinculado. Recriamos a
-- política permissiva de leitura própria para garantir o acesso ao painel.
drop policy if exists appointments_read_assigned_barber on public.appointments;
create policy appointments_read_assigned_barber
on public.appointments for select to authenticated
using (public.is_current_user_assigned_barber(barbershop_id, barber_id));

-- O portal do barbeiro é somente leitura: apenas proprietário/admin atualiza
-- ou exclui agendamentos. A criação pública continua pela RPC SECURITY DEFINER.
drop policy if exists appointments_update_assigned_barber on public.appointments;
drop policy if exists appointments_isolation_update on public.appointments;
create policy appointments_isolation_update
on public.appointments as restrictive
for update to authenticated
using (public.has_shop_role(barbershop_id, array['owner','admin']::text[]))
with check (public.has_shop_role(barbershop_id, array['owner','admin']::text[]));

drop policy if exists appointments_isolation_delete on public.appointments;
create policy appointments_isolation_delete
on public.appointments as restrictive
for delete to authenticated
using (public.has_shop_role(barbershop_id, array['owner','admin']::text[]));

-- Barbeiro só pode ler o próprio registro; a criação/edição de contas continua
-- exclusivamente no servidor, pela Edge Function autenticada do proprietário.
revoke all on function public.current_user_barber_id(uuid) from public;
revoke all on function public.is_current_user_assigned_barber(uuid, uuid) from public;
grant execute on function public.current_user_barber_id(uuid) to authenticated;
grant execute on function public.is_current_user_assigned_barber(uuid, uuid) to authenticated;

commit;
