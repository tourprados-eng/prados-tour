-- Prado's Tour / Sistema de promoções e ofertas
--
-- Cria a estrutura de promoções (reutilizando a estrutura de cupons já
-- existente), evolui `coupons` com novos controles e adiciona ao histórico de
-- reservas o detalhamento dos descontos aplicados (auditoria de preço).
--
-- IDEMPOTENTE: colunas/tabelas/valores usam IF NOT EXISTS / ON CONFLICT DO
-- NOTHING; policies e enums não são recriados se já existirem.

begin;

-- ---------------------------------------------------------------------------
-- Tabelas de promoções
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.promotion_discount_type as enum ('PERCENTUAL','FIXO','PRECO');
exception when duplicate_object then null; end $$;

create table if not exists public.promotions(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  discount_type public.promotion_discount_type not null default 'PERCENTUAL',
  discount_value numeric(12,2) not null default 0,
  promo_price_person numeric(12,2),
  promo_price_couple numeric(12,2),
  pix_discount_percent numeric(5,4),
  stackable boolean not null default false,
  coupon_id uuid references public.coupons(id) on delete set null,
  all_trips boolean not null default false,
  usage_limit int,
  per_user_limit int,
  start_date timestamptz,
  end_date timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(discount_type <> 'PRECO' or promo_price_person is not null or promo_price_couple is not null)
);

create table if not exists public.promotion_trips(
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  primary key(promotion_id, trip_id)
);

create table if not exists public.promotion_usages(
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid references public.promotions(id) on delete cascade,
  user_id uuid references public.profiles(id),
  booking_id uuid references public.bookings(id),
  created_at timestamptz default now(),
  unique(promotion_id, booking_id)
);

-- ---------------------------------------------------------------------------
-- Evolução de `coupons` (novos controles exigidos pelo sistema de ofertas)
-- ---------------------------------------------------------------------------

alter table public.coupons
  add column if not exists valid_from timestamptz,
  add column if not exists min_amount numeric(12,2),
  add column if not exists per_user_limit int,
  add column if not exists stackable boolean not null default false,
  add column if not exists description text;

-- ---------------------------------------------------------------------------
-- Auditoria de descontos nas reservas
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column if not exists promotion_id uuid references public.promotions(id),
  add column if not exists promotion_name text,
  add column if not exists promotion_discount numeric(12,2) not null default 0,
  add column if not exists coupon_discount numeric(12,2) not null default 0,
  add column if not exists pix_discount numeric(12,2) not null default 0;

-- ---------------------------------------------------------------------------
-- RLS das novas tabelas
-- ---------------------------------------------------------------------------

alter table public.promotions enable row level security;
alter table public.promotion_trips enable row level security;
alter table public.promotion_usages enable row level security;

create policy promotions_public on promotions for select using(
  active and (deleted_at is null) and (start_date is null or start_date <= now()) and (end_date is null or end_date >= now())
  or is_staff()
);
create policy promotions_staff on promotions for all using(is_staff()) with check(is_staff());

create policy promotion_trips_public on promotion_trips for select using(
  exists(select 1 from public.promotions p where p.id = promotion_id and p.active and p.deleted_at is null)
  or is_staff()
);
create policy promotion_trips_staff on promotion_trips for all using(is_staff()) with check(is_staff());

create policy promotion_usage_staff on promotion_usages for all using(is_staff() or user_id = auth.uid()) with check(is_staff() or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Configuração padrão do banner de ofertas
-- ---------------------------------------------------------------------------

insert into public.settings(key, value) values(
  'promo_banner',
  '{"title":"Ofertas especias","subtitle":"Promoções da Prado''s Tour","description":"","image_url":"","button_text":"Ver ofertas","button_link":"/ofertas","active":false,"sort_order":0}'::jsonb
) on conflict(key) do nothing;

commit;