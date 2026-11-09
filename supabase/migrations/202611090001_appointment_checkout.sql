-- Fechamento de atendimento: pagamento, descontos e produtos vendidos vinculados.
-- Execute no projeto Supabase exclusivo do AgendaKopcode.

begin;

alter table public.appointments
  add column if not exists payment_method text,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists discount_reason text;

alter table public.appointments
  drop constraint if exists appointments_payment_method_check;
alter table public.appointments
  add constraint appointments_payment_method_check
  check (payment_method is null or payment_method in ('dinheiro','credito','debito','pix','outro'));

alter table public.appointments
  drop constraint if exists appointments_discount_amount_check;
alter table public.appointments
  add constraint appointments_discount_amount_check
  check (discount_amount >= 0);

alter table public.product_sales
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists payment_method text;

create index if not exists product_sales_appointment_idx
  on public.product_sales(appointment_id)
  where appointment_id is not null;

create or replace function public.complete_appointment_with_payment(
  p_appointment_id uuid,
  p_payment_method text,
  p_discount_amount numeric default 0,
  p_discount_reason text default null,
  p_products jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_service_price numeric(10,2);
  v_discount numeric(10,2);
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
begin
  if auth.uid() is null then
    raise exception 'Faça login para concluir o atendimento.';
  end if;

  if p_payment_method not in ('dinheiro','credito','debito','pix','outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select a.* into v_appointment
  from public.appointments a
  join public.barbershops bs on bs.id = a.barbershop_id
  where a.id = p_appointment_id
    and bs.owner_id = auth.uid()
  for update of a;

  if not found then
    raise exception 'Agendamento não encontrado ou sem permissão.';
  end if;

  if v_appointment.status = 'completed' then
    raise exception 'Este atendimento já foi concluído.';
  end if;

  select coalesce(v_appointment.price_at_booking, s.price, 0)
    into v_service_price
  from public.services s
  where s.id = v_appointment.service_id
    and s.barbershop_id = v_appointment.barbershop_id;

  v_service_price := coalesce(v_service_price, v_appointment.price_at_booking, 0);
  v_discount := coalesce(p_discount_amount, 0);

  if v_discount < 0 or v_discount > v_service_price then
    raise exception 'Desconto inválido para o valor do serviço.';
  end if;

  if v_discount > 0 and nullif(btrim(p_discount_reason), '') is null then
    raise exception 'Informe o motivo do desconto.';
  end if;

  update public.appointments
  set status = 'completed',
      payment_method = p_payment_method,
      discount_amount = v_discount,
      discount_reason = nullif(btrim(p_discount_reason), '')
  where id = p_appointment_id;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_products, '[]'::jsonb))
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    if v_quantity is null or v_quantity < 1 then
      raise exception 'Quantidade de produto inválida.';
    end if;

    insert into public.product_sales (
      barbershop_id, product_id, product_name, quantity, unit_price,
      sold_by, appointment_id, payment_method
    )
    values (
      v_appointment.barbershop_id, v_product_id, 'Venda vinculada ao atendimento',
      v_quantity, 0, auth.uid(), p_appointment_id, p_payment_method
    );
  end loop;
end;
$$;

revoke all on function public.complete_appointment_with_payment(uuid,text,numeric,text,jsonb) from public;
grant execute on function public.complete_appointment_with_payment(uuid,text,numeric,text,jsonb) to authenticated;

commit;
