-- Prado's Tour / FASE 6 - ETAPA 2.1 (limpeza/dados preservados)
-- 1) Despesa real órfã: "Locação ônibus Ilhabela" (R$ 2.500) referencia a viagem
--    f67bc481 (excluída da migração) e um perfil fictício (e8d9f80f). Preservada
--    com trip_id/created_by NULL. O outro registro ("fgfgfgfggf", R$ 2.000) é lixo
--    de teste e foi intencionalmente ignorado.
-- 2) Sanitiza CPF inválido do passageiro da reserva PT000006 (gerado em teste).

begin;

insert into public.expenses (id, category, amount, expense_date, description, trip_id, created_by, created_at) values
  ('06a3396b-364e-46e9-a474-7304a4ca6082', 'Transporte', 2500, '2026-09-01', 'Locação ônibus Ilhabela', NULL, NULL, '2026-09-05T03:14:00.830Z'::timestamptz)
on conflict (id) do nothing;

update public.booking_passengers
set cpf = null
where id = '613b2ff7-3ed0-4615-b23f-e759e3be967c' and cpf = '3312313131313';

commit;