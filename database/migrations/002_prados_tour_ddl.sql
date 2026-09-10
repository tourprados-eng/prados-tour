-- Prado's Tour / Supabase
-- ETAPA 1: extensão, enums, tabelas, constraints e índices.
-- Execute somente em um banco Supabase novo e vazio.
-- Não cria usuários, não migra dados e não altera auth.users.

create extension if not exists pgcrypto;

create type public.app_role as enum ('SUPER_ADMIN','ADMIN','FINANCEIRO','VENDEDOR','MONITOR','CLIENTE');
create type public.trip_status as enum ('RASCUNHO','PUBLICADA','ESGOTADA','CANCELADA','FINALIZADA');
create type public.booking_status as enum ('PENDENTE','CONFIRMADA','CANCELADA','CONCLUIDA');
create type public.payment_status as enum ('PENDENTE','PAGO','ESTORNADO','CANCELADO','ATRASADO');
create type public.payment_method as enum ('PIX','CARTAO');
create type public.payment_plan as enum ('TOTAL','PARCIAL');
create type public.installment_status as enum ('PENDENTE','PAGO','ATRASADO','CANCELADO');
create type public.commission_status as enum ('PENDENTE','APROVADA','PAGA','CANCELADA');
create type public.customer_class as enum ('NOVO','RECORRENTE','VIP','INATIVO');
create type public.coupon_type as enum ('PERCENTUAL','FIXO');

-- profiles.id só poderá ser preenchido para usuários já criados no Supabase Auth.
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  cpf text not null unique,
  birth_date date,
  email text not null unique,
  phone text,
  whatsapp text,
  role public.app_role not null default 'CLIENTE',
  customer_class public.customer_class not null default 'NOVO',
  referral_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  destination text not null,
  category text not null,
  date date not null,
  departure_time time,
  return_time time,
  price_person numeric(12,2) not null check(price_person >= 0),
  price_couple numeric(12,2) check(price_couple is null or price_couple >= 0),
  total_seats int not null check(total_seats > 0),
  description text,
  itinerary text,
  included text,
  not_included text,
  rules text,
  cancellation_policy text,
  form_url text,
  form_required boolean not null default false,
  status public.trip_status not null default 'RASCUNHO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boarding_points(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude numeric,
  longitude numeric,
  observations text,
  active boolean not null default true
);

create table public.trip_images(
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  url text not null,
  sort_order int not null default 0 check(sort_order >= 0)
);

create table public.trip_boarding_points(
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  boarding_point_id uuid not null references public.boarding_points(id),
  time time,
  unique(trip_id, boarding_point_id)
);

create table public.seats(
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  seat_number text not null,
  state text not null default 'DISPONIVEL' check(state in('DISPONIVEL','SELECIONADO','OCUPADO','BLOQUEADO')),
  booking_id uuid,
  unique(trip_id, seat_number)
);

create table public.sellers(
  id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  commission_rate numeric(6,4) not null default 0.10 check(commission_rate >= 0 and commission_rate <= 1)
);

create table public.bookings(
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references public.profiles(id),
  trip_id uuid not null references public.trips(id),
  seller_id uuid references public.sellers(id),
  quantity int not null check(quantity > 0),
  boarding_point_id uuid references public.boarding_points(id),
  boarding_point text,
  total_amount numeric(12,2) not null check(total_amount >= 0),
  base_amount numeric(12,2) not null check(base_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check(discount_amount >= 0),
  coupon_code text,
  payment_plan public.payment_plan not null,
  status public.booking_status not null default 'PENDENTE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seats add constraint seats_booking_fk
  foreign key(booking_id) references public.bookings(id) on delete set null;

create table public.booking_passengers(
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  name text not null,
  cpf text,
  birth_date date,
  phone text,
  seat_id uuid references public.seats(id),
  boarding_point_id uuid references public.boarding_points(id),
  seat_group text,
  seat_assignment_status text not null default 'PENDENTE' check(seat_assignment_status in('PENDENTE','ATRIBUIDO','MANUAL')),
  travel_together boolean not null default true,
  group_id uuid,
  group_name text,
  observations text
);

create table public.payments(
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid references public.profiles(id),
  method public.payment_method,
  plan public.payment_plan,
  amount numeric(12,2) not null check(amount >= 0),
  status public.payment_status not null default 'PENDENTE',
  gateway text,
  gateway_payment_id text,
  fee_amount numeric(12,2) not null default 0 check(fee_amount >= 0),
  net_amount numeric(12,2),
  paid_at timestamptz,
  pix_copy_paste text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.payment_installments(
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  number int not null check(number > 0),
  value numeric(12,2) not null check(value >= 0),
  due_date date not null,
  status public.installment_status not null default 'PENDENTE',
  paid_at timestamptz,
  method public.payment_method,
  unique(booking_id, number)
);

create table public.coupons(
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type public.coupon_type not null,
  value numeric(12,2) not null check(value >= 0),
  usage_limit int check(usage_limit is null or usage_limit > 0),
  valid_until timestamptz,
  active boolean not null default true
);

create table public.coupon_trips(
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  primary key(coupon_id, trip_id)
);

create table public.coupon_usages(
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  user_id uuid not null references public.profiles(id),
  booking_id uuid not null references public.bookings(id),
  created_at timestamptz not null default now(),
  unique(coupon_id, user_id, booking_id)
);

create table public.commissions(
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  booking_id uuid not null references public.bookings(id),
  rate numeric(6,4) not null check(rate >= 0 and rate <= 1),
  amount numeric(12,2) not null check(amount >= 0),
  status public.commission_status not null default 'PENDENTE',
  paid_at timestamptz
);

create table public.expenses(
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric(12,2) not null check(amount >= 0),
  expense_date date not null,
  description text,
  trip_id uuid references public.trips(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.checkins(
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  passenger_id uuid not null references public.booking_passengers(id),
  checked_at timestamptz not null default now(),
  employee_id uuid not null references public.profiles(id),
  unique(passenger_id)
);

create table public.notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reviews(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  trip_id uuid not null references public.trips(id),
  rating int check(rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(customer_id, trip_id)
);

create table public.loyalty_points(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  points int not null,
  source text,
  booking_id uuid references public.bookings(id),
  created_at timestamptz not null default now()
);

create table public.referrals(
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id),
  referred_id uuid not null references public.profiles(id),
  code text not null,
  created_at timestamptz not null default now(),
  unique(referrer_id, referred_id)
);

create table public.settings(
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.audit_logs(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip text,
  created_at timestamptz not null default now()
);

-- Índices para FKs e consultas operacionais frequentes.
create index profiles_role_idx on public.profiles(role);
create index trips_status_date_idx on public.trips(status, date);
create index trip_images_trip_idx on public.trip_images(trip_id, sort_order);
create index trip_boarding_points_point_idx on public.trip_boarding_points(boarding_point_id);
create index seats_trip_state_idx on public.seats(trip_id, state);
create index seats_booking_idx on public.seats(booking_id);
create index bookings_customer_idx on public.bookings(customer_id);
create index bookings_trip_status_idx on public.bookings(trip_id, status);
create index bookings_seller_idx on public.bookings(seller_id);
create index booking_passengers_booking_idx on public.booking_passengers(booking_id);
create index booking_passengers_seat_idx on public.booking_passengers(seat_id);
create index payments_booking_idx on public.payments(booking_id);
create index payments_customer_status_idx on public.payments(customer_id, status);
create index payments_gateway_idx on public.payments(gateway_payment_id);
create index payment_installments_booking_idx on public.payment_installments(booking_id);
create index coupon_usages_coupon_idx on public.coupon_usages(coupon_id);
create index coupon_usages_user_idx on public.coupon_usages(user_id);
create index coupon_usages_booking_idx on public.coupon_usages(booking_id);
create index commissions_seller_idx on public.commissions(seller_id);
create index commissions_booking_idx on public.commissions(booking_id);
create index expenses_trip_idx on public.expenses(trip_id);
create index expenses_created_by_idx on public.expenses(created_by);
create index checkins_booking_idx on public.checkins(booking_id);
create index notifications_user_read_idx on public.notifications(user_id, read);
create index reviews_trip_idx on public.reviews(trip_id);
create index loyalty_points_customer_idx on public.loyalty_points(customer_id);
create index loyalty_points_booking_idx on public.loyalty_points(booking_id);
create index referrals_referred_idx on public.referrals(referred_id);
create index audit_logs_user_created_idx on public.audit_logs(user_id, created_at);
