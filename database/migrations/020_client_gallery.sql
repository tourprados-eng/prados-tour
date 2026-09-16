-- Prado's Tour — Galeria de momentos
--
-- Fotos enviadas por clientes passam por moderação antes de serem públicas.
-- Nenhuma foto existente das excursões é alterada.

begin;

-- ---------------------------------------------------------------------------
-- 1) Status da foto
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.gallery_photo_status as enum (
    'PENDENTE',
    'APROVADO',
    'REJEITADO'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) Fotos da galeria
-- ---------------------------------------------------------------------------
create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid references public.profiles(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,

  url text not null,
  caption text,

  status public.gallery_photo_status not null default 'PENDENTE',

  show_on_home boolean not null default false,
  sort_order int not null default 0
    check (sort_order >= 0),

  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) Índices
-- ---------------------------------------------------------------------------
create index if not exists gallery_photos_status_idx
  on public.gallery_photos(status);

create index if not exists gallery_photos_customer_idx
  on public.gallery_photos(customer_id);

create index if not exists gallery_photos_trip_idx
  on public.gallery_photos(trip_id);

create index if not exists gallery_photos_home_idx
  on public.gallery_photos(show_on_home, sort_order);

-- ---------------------------------------------------------------------------
-- 4) Segurança
-- ---------------------------------------------------------------------------
alter table public.gallery_photos enable row level security;

-- Público só enxerga fotos aprovadas e liberadas para a Home.
create policy gallery_photos_public
  on public.gallery_photos
  for select
  using (
    status = 'APROVADO'
    and show_on_home = true
  );

-- Cliente pode consultar apenas as próprias fotos.
create policy gallery_photos_customer_select
  on public.gallery_photos
  for select
  using (
    customer_id = auth.uid()
  );

-- Cliente autenticado pode enviar uma foto.
create policy gallery_photos_customer_insert
  on public.gallery_photos
  for insert
  with check (
    customer_id = auth.uid()
    and status = 'PENDENTE'
    and show_on_home = false
    and reviewed_by is null
    and reviewed_at is null
  );

-- Administração controla a moderação.
create policy gallery_photos_admin
  on public.gallery_photos
  for all
  using (private.is_admin())
  with check (private.is_admin());

commit;
