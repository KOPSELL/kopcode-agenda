-- AgendaKopcode: trava definitiva contra duas reservas simultâneas para o mesmo profissional.
-- Execute SOMENTE no projeto Supabase AgendaKopcode: hfxakwkmitmjvmzzyytq.
-- Não apaga nem cancela agendamentos existentes.

begin;

create extension if not exists btree_gist;

-- Não instala silenciosamente se houver conflito antigo: preserva os dados e informa o problema.
do $$
begin
  if exists (
    select 1
    from public.appointments a
    join public.appointments b
      on a.barbershop_id = b.barbershop_id
     and a.barber_id = b.barber_id
     and a.id < b.id
     and a.starts_at < b.ends_at
     and a.ends_at > b.starts_at
    where a.status in ('pending', 'confirmed')
      and b.status in ('pending', 'confirmed')
  ) then
    raise exception 'Há reservas pendentes/confirmadas sobrepostas. Resolva os conflitos existentes antes de ativar a proteção. Nenhum registro foi apagado.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_no_overlapping_barber_time'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_no_overlapping_barber_time
      exclude using gist (
        barbershop_id with =,
        barber_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (status in ('pending', 'confirmed'));
  end if;
end $$;

-- Disponibiliza mudanças de agenda em tempo real quando a publicação existe.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'appointments'
     ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;

commit;
