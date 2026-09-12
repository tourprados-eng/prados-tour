-- =====================================================================
-- Preço de crianças, seguro viagem e políticas por viagem.
-- Idempotente (add column if not exists) e não destrutivo.
-- =====================================================================
-- trips.transport_policy            política de transporte por viagem.
-- trips.child_price / child_max_age preço e idade-limite da criança.
-- trips.insurance_enabled/_price    habilita seguro e valor por pessoa.
-- booking_passengers.price          preço pago por aquele passageiro.
-- booking_passengers.price_category 'ADULTO' | 'CRIANCA'.
-- booking_passengers.insurance      passageiro com seguro contratado.
-- bookings.child_count/_insurance_count/_insurance_amount  resumo da reserva.
-- =====================================================================

alter table public.trips
  add column if not exists child_price numeric(12,2)
    check (child_price is null or child_price >= 0),
  add column if not exists child_max_age int
    check (child_max_age is null or child_max_age >= 0),
  add column if not exists insurance_enabled boolean not null default false,
  add column if not exists insurance_price numeric(12,2) not null default 20.00
    check (insurance_price >= 0),
  add column if not exists transport_policy text;

alter table public.bookings
  add column if not exists child_count int not null default 0
    check (child_count >= 0),
  add column if not exists insurance_count int not null default 0
    check (insurance_count >= 0),
  add column if not exists insurance_amount numeric(12,2) not null default 0
    check (insurance_amount >= 0);

alter table public.booking_passengers
  add column if not exists price numeric(12,2)
    check (price is null or price >= 0),
  add column if not exists price_category text
    check (price_category is null or price_category in ('ADULTO', 'CRIANCA')),
  add column if not exists insurance boolean not null default false;