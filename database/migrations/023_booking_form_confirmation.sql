-- 023: Confirmação do formulário externo obrigatório após o pagamento.
-- NULL = formulário ainda não confirmado.
-- Timestamp = cliente confirmou o preenchimento.

alter table public.bookings
  add column if not exists form_confirmed_at timestamptz;

