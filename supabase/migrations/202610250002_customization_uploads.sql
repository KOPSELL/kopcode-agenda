-- AgendaKopcode: identidade visual e upload de fotos por barbearia
-- Execute somente no projeto KOPCODE: hfxakwkmitmjvmzzyytq.
-- Cria colunas e políticas limitadas à barbearia dona da imagem.

begin;

alter table public.barbershops
  add column if not exists description text,
  add column if not exists address text,
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists theme_color text not null default '#d9b77b';

alter table public.barbers
  add column if not exists photo_url text;

alter table public.services
  add column if not exists photo_url text;

-- Bucket público para exibir imagens no link de agendamento.
-- Escrita/alteração/exclusão continuam limitadas ao dono da barbearia.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agenda-photos', 'agenda-photos', true, 8388608,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update
set public = true,
    file_size_limit = 8388608,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Agenda photos public read" on storage.objects;
create policy "Agenda photos public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'agenda-photos');

drop policy if exists "Agenda photos owner insert" on storage.objects;
create policy "Agenda photos owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'agenda-photos'
  and exists (
    select 1 from public.barbershops bs
    where bs.id::text = (storage.foldername(name))[1]
      and bs.owner_id = (select auth.uid())
  )
);

drop policy if exists "Agenda photos owner update" on storage.objects;
create policy "Agenda photos owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'agenda-photos'
  and exists (
    select 1 from public.barbershops bs
    where bs.id::text = (storage.foldername(name))[1]
      and bs.owner_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'agenda-photos'
  and exists (
    select 1 from public.barbershops bs
    where bs.id::text = (storage.foldername(name))[1]
      and bs.owner_id = (select auth.uid())
  )
);

drop policy if exists "Agenda photos owner delete" on storage.objects;
create policy "Agenda photos owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'agenda-photos'
  and exists (
    select 1 from public.barbershops bs
    where bs.id::text = (storage.foldername(name))[1]
      and bs.owner_id = (select auth.uid())
  )
);

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
    'description', bs.description,
    'address', bs.address,
    'logo_url', bs.logo_url,
    'cover_url', bs.cover_url,
    'theme_color', bs.theme_color,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'description', s.description,
        'price', s.price, 'duration_minutes', s.duration_minutes,
        'photo_url', s.photo_url
      ) order by s.name)
      from public.services s
      where s.barbershop_id = bs.id and s.active = true
    ), '[]'::jsonb),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'photo_url', b.photo_url
      ) order by b.name)
      from public.barbers b
      where b.barbershop_id = bs.id and b.active = true
    ), '[]'::jsonb)
  )
  from public.barbershops bs
  where bs.slug = lower(trim(p_slug)) and bs.active = true
  limit 1;
$$;

revoke all on function public.get_public_shop(text) from public;
grant execute on function public.get_public_shop(text) to anon, authenticated;

commit;
