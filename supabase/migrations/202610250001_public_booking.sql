-- AgendaKopcode: funções públicas seguras para consulta e criação de agendamentos
-- Execute no SQL Editor do projeto KOPCODE (hfxakwkmitmjvmzzyytq).
-- Não executa alterações nos outros projetos.

begin;

-- Dados públicos da página de agendamento: somente estabelecimento ativo,
-- serviços ativos e barbeiros ativos. Não expõe e-mails nem dados de clientes.
create or replace function public.get_public_shop(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', bs.id,
    'name', bs.name,
    'slug', bs.slug,
    'phone', bs.phone,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'description', s.description,
        'price', s.price, 'duration_minutes', s.duration_minutes
      ) order by s.name)
      from public.services s
      where s.barbershop_id = bs.id and s.active = true
    ), '[]'::jsonb),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name
      ) order by b.name)
      from public.barbers b
      where b.barbershop_id = bs.id and b.active = true
    ), '[]'::jsonb)
  )
  from public.barbershops bs
  where bs.slug = lower(trim(p_slug)) and bs.active = true
  limit 1;
$$;

-- Horários ocupados, sem expor nome/telefone ou notas do cliente.
create or replace function public.get_public_busy_slots(
  p_slug text,
  p_date date,
  p_barber_id uuid
)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at, a.ends_at
  from public.appointments a
  join public.barbershops bs on bs.id = a.barbershop_id
  where bs.slug = lower(trim(p_slug))
    and bs.active = true
    and a.barber_id = p_barber_id
    and a.status in ('pending', 'confirmed')
    and a.starts_at < ((p_date + 1)::timestamp at time zone bs.timezone)
    and a.ends_at > (p_date::timestamp at time zone bs.timezone);
$$;

-- Criação pública validada no banco; a constraint de exclusão evita corrida
-- entre dois clientes que tentem reservar o mesmo intervalo simultaneamente.
create or replace function public.create_public_appointment(
  p_slug text,
  p_barber_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop public.barbershops%rowtype;
  v_service public.services%rowtype;
  v_appointment public.appointments%rowtype;
  v_local_start timestamp;
begin
  if length(trim(coalesce(p_client_name, ''))) < 2 then
    raise exception 'Informe seu nome completo.';
  end if;
  if length(regexp_replace(coalesce(p_client_phone, ''), '[^0-9]', '', 'g')) < 10 then
    raise exception 'Informe um telefone/WhatsApp válido.';
  end if;
  if p_starts_at <= now() then
    raise exception 'Escolha um horário futuro.';
  end if;

  select * into v_shop
  from public.barbershops
  where slug = lower(trim(p_slug)) and active = true;

  if not found then
    raise exception 'Barbearia não encontrada ou indisponível.';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and barbershop_id = v_shop.id and active = true;

  if not found then
    raise exception 'Serviço indisponível.';
  end if;

  if not exists (
    select 1 from public.barbers
    where id = p_barber_id and barbershop_id = v_shop.id and active = true
  ) then
    raise exception 'Profissional indisponível.';
  end if;

  v_local_start := p_starts_at at time zone v_shop.timezone;
  if extract(isodow from v_local_start) > 6
     or v_local_start::time < time '08:00'
     or (v_local_start + make_interval(mins => v_service.duration_minutes))::time > time '21:00' then
    raise exception 'Horário fora da janela de atendimento.';
  end if;

  insert into public.appointments (
    barbershop_id, barber_id, service_id, client_name, client_phone,
    starts_at, ends_at, status, notes
  )
  values (
    v_shop.id, p_barber_id, v_service.id, trim(p_client_name),
    trim(p_client_phone), p_starts_at,
    p_starts_at + make_interval(mins => v_service.duration_minutes),
    'confirmed', nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_appointment;

  return jsonb_build_object(
    'id', v_appointment.id,
    'starts_at', v_appointment.starts_at,
    'ends_at', v_appointment.ends_at,
    'status', v_appointment.status,
    'shop_name', v_shop.name
  );
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado. Escolha outro horário.';
end;
$$;

revoke all on function public.get_public_shop(text) from public;
revoke all on function public.get_public_busy_slots(text, date, uuid) from public;
revoke all on function public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text) from public;

grant execute on function public.get_public_shop(text) to anon, authenticated;
grant execute on function public.get_public_busy_slots(text, date, uuid) to anon, authenticated;
grant execute on function public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text) to anon, authenticated;

commit;
