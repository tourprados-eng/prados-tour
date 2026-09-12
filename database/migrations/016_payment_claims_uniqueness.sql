-- ============================================================================
-- PROPOSTA — 016: proteção contra concorrência/duplicidade de cobranças Asaas.
-- NÃO EXECUTADA. Aguarda aprovação em revisão.
-- ============================================================================
-- Contexto:
--   Uma transação PostgreSQL não desfaz cobrança criada no Asaas. A proteção
--   é feita por (1) claim atômica que decide o "dono" da cobrança ANTES de
--   qualquer POST ao Asaas e (2) constraints que impedem dois payments
--   internos para a mesma cobrança/externalReference.
--
-- Historico: em public.payments só existem pagamentos demo
--   (gateway 'demo-pix'/'demo-card', gateway_payment_id 'gw_...'), nenhum com
--   gateway='asaas'. A coluna nova fica NULL nas linhas existentes e cartão
--   nunca a preenche. Nada de histórico é alterado.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Tabela de claim (ledger idempotente).
--    PK = chave determinística da OPERAÇÃO de cobrança (paymentId PIX
--    determinístico). Insert on conflict decide o vencedor da corrida.
--    lease_until expira a posse: uma operação interrompida nunca fica
--    bloqueada para sempre (take-over CAS posterior).
-- ---------------------------------------------------------------------------
create table if not exists public.payment_claims(
  idempotency_key uuid primary key,
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid references public.profiles(id),
  trip_id uuid references public.trips(id),
  payment_id uuid,
  charge_id text,
  status text not null default 'PENDING'
    check(status in ('PENDING', 'CHARGED')),
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_claims_booking_idx
  on public.payment_claims(booking_id);
create index if not exists payment_claims_status_idx
  on public.payment_claims(status);
create index if not exists payment_claims_customer_trip_idx
  on public.payment_claims(customer_id, trip_id);

-- Servidor-only: nenhuma policy. Service role ignora RLS; anon/autenticado
-- não enxergam nem escrevem (nenhum grant explícito).
alter table public.payment_claims enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Guarda reversa: nunca dois payments internos para a MESMA cobrança.
--    Linhas demo (gateway <> 'asaas') ficam de fora do índice parcial.
-- ---------------------------------------------------------------------------
create unique index if not exists payments_asaas_charge_uq
  on public.payments (gateway_payment_id)
  where gateway = 'asaas' and gateway_payment_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Referência externa Asaas como coluna própria + unicidade parcial.
--    Linhas históricas (NULL) e cartão (NULL) não são afetadas.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists asaas_external_reference text;

create unique index if not exists payments_asaas_external_reference_uq
  on public.payments (asaas_external_reference)
  where asaas_external_reference is not null;

-- ============================================================================
-- ROLLBACK (inversa, caso necessário):
--   drop table public.payment_claims;
--   drop index public.payments_asaas_charge_uq;
--   alter table public.payments drop column asaas_external_reference;
-- ============================================================================