-- AgendaKopcode: proteção contra reservas sobrepostas e atualização em tempo real.
-- Executar SOMENTE no Supabase do AgendaKopcode: hfxakwkmitmjvmzzyytq.
-- Reservas pendentes/confirmadas do mesmo profissional não podem se sobrepor.

begin;

create extension if not exists btree_gist;

-- Se já houver reservas conflitantes, interrompe sem cancelar nem apagar agendamentos.
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
    raise exception 'Existem agendamentos pendentes/confirmados com horários sobrepostos. Resolva esses conflitos antes de ativar a trava; nenhum agendamento foi apagado.';
  end if;
end $$;

do $$
begin
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

-- Ativa a publicação Realtime para a tabela, se ainda não estiver incluída.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'appointments'
     ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;

commit;
