-- 029_balance_reconciliation_runs.sql
--
-- Registro de execuções da reconciliação inicial de saldos (ativada no
-- bootstrap de produção). Garante que a rotina rode UMA única vez por
-- chave, mesmo se o deploy/serverless for reiniciado:
--
--  - INSERT ... ON CONFLICT (run_key) DO NOTHING: só o primeiro processo
--    vence o lock e executa; os demais veem a linha existente e pulam.
--  - status='executing' marca início; 'success'/'failed' conclui.
--
-- RLS: tabela somente para o servidor (service role), igual a
-- payment_webhook_events e balance_reminders.

create table if not exists public.balance_reconciliation_runs (
  run_key text primary key,
  status text not null check (status in ('executing', 'success', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  error text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null
);

alter table public.balance_reconciliation_runs enable row level security;

-- Nenhuma role da aplicação acessa esta tabela via PostgREST (service role).