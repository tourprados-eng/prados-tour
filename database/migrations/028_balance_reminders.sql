-- 028_balance_reminders.sql
--
-- Lembretes de SALDO RESTANTE (reservas com pagamento parcial).
-- Contém APENAS registros de envio/agendamento — a decisão de COBRANÇA (PIX)
-- vive em payments (metadata.type = 'BALANCE', criada pelo fluxo do saldo).
--
-- Garantias:
--  - idempotência local: UNIQUE (booking_id, kind, reminder_date);
--  - janelas únicas (prazo próximo / prazo venceu hoje) com UNIQUE (booking_id,
--    kind) quando reminder_date NULL — um único lembrete por reserva/janela;
--  - reenvio de SALDO VENCIDO controlado por intervalo (3 dias) + unique por dia;
--  - RLS: tabela somente para o servidor (nenhuma role acessa via PostgREST),
--    replicando o padrão de payment_webhook_events.
--
-- Esta tabela NÃO interfere no e-mail de confirmação de cadastro do Supabase Auth.

create table if not exists public.balance_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null check (kind in ('PRAZO_PROXIMO', 'PRAZO_VENCIDO', 'SALDO_VENCIDO', 'AVISO_INICIAL')),
  email text not null,
  reminder_date date not null,
  status text not null check (status in ('REGISTRADA', 'ENVIADA')),
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (booking_id, kind, reminder_date),
  unique (booking_id, kind)
);

create index if not exists balance_reminders_booking_idx
  on public.balance_reminders (booking_id, reminder_date);

alter table public.balance_reminders enable row level security;

-- Nenhuma role da aplicação acessa esta tabela via PostgREST: o servidor usa a
-- service role. Policies existem apenas como defesa em profundidade (nada).