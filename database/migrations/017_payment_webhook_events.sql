-- =====================================================================
-- PROPOSTA — NÃO EXECUTADA. Aguarda aprovação em revisão.
-- =====================================================================
-- Objetivo: IDEMPOTÊNCIA COM RETRY SEGURO do webhook oficial do Asaas.
--
-- O Asaas entrega eventos "at-least-once": o mesmo `body.id` pode chegar
-- várias vezes, inclusive com atraso. A tabela diferencia o ciclo de vida
-- do evento para nunca perder uma confirmação legítima:
--
--   status = 'PROCESSING' -> evento CLAIMADO, em processamento (insert
--     atômico na PK event_id). Se o processamento abandonar (crash), o
--     detentor legítimo faz re-claim por CAS na `claimed_at` após um
--     período seguro.
--   status = 'PROCESSED'  -> evento definitivamente consumido (sucesso ou
--     rejeição definitiva de IDEMPOTÊNCIA). Reentrega = 200 sem efeitos.
--   row ausente           -> nunca processado, OU falha TRANSITÓRIA que
--     liberou a row para reprocessar o mesmo body.id legitimamente.
--
-- ATOMICIDADE: a decisão de quem processa é o INSERT na PK `event_id`
-- (constraint UNIQUE). Nenhuma regra de negócio roda sem antes vencer a
-- claim. Duas entregas simultâneas do mesmo evento: uma processa, a outra
-- responde 503 (Asaas reenvia mais tarde).
--
-- SERVER-ONLY: RLS HABILITADO, SEM policy anon/authenticated. Service role
-- ignora RLS (único acesso, via client Supabase server-only). anon e
-- authenticated não leem nem gravam nesta tabela.
--
-- Sem BEGIN/COMMIT manuais: o mecanismo de migration controla a transação.
--
-- Eventos PAYMENT_REFUNDED/chargeback NÃO são tratados nesta versão.
-- =====================================================================

create table if not exists public.payment_webhook_events (
  event_id     text primary key,
  event        text not null,
  payment_id   text,
  booking_id   uuid references public.bookings(id) on delete set null,
  status       text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'PROCESSED')),
  claimed_at   timestamptz not null default now(),
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists payment_webhook_events_payment_idx
  on public.payment_webhook_events (payment_id);

-- Servidor-only: nenhuma policy. Service role ignora RLS; anon/autenticado
-- são barrados (padrão deny) pelo RLS habilitado e falta de grant/policy.
alter table public.payment_webhook_events enable row level security;

-- =====================================================================
-- FIM DA PROPOSTA. NÃO EXECUTAR SEM APROVAÇÃO.
-- =====================================================================