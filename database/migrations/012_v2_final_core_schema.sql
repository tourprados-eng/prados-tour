-- Prado's Tour / V2 FINAL — Bloco A (schema de núcleo)
--
-- 1) trips.return_date — data de retorno opcional (viagens noturnas/bate-volta).
-- 2) trip_boarding_points.sort_order — ordem de embarque configurável por viagem.
-- 3) reviews — moderação de avaliações (status + revisão por staff).
-- 4) boarding_points — correção de cidade: Anhanguera Parque Shopping -> Cajamar.
--
-- IDEMPOTENTE (IF NOT EXISTS / DO $$ ...) e segura para dados existentes.

begin;

-- ---------------------------------------------------------------------------
-- 1) Data de retorno (opcional; preenchida depois pelo painel)
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists return_date date;

-- ---------------------------------------------------------------------------
-- 2) Ordem de embarque por viagem
-- ---------------------------------------------------------------------------
alter table public.trip_boarding_points
  add column if not exists sort_order int not null default 0
  check (sort_order >= 0);

-- Backfill estável: ordena os pontos existentes pelo horário dentro de cada
-- viagem (horários nulos ficam no fim; UUID empata de forma estável).
update public.trip_boarding_points t
set sort_order = sub.ord
from (
  select id,
         row_number() over (
           partition by trip_id
           order by time nulls last, id
         ) - 1 as ord
  from public.trip_boarding_points
) sub
where t.id = sub.id;

-- ---------------------------------------------------------------------------
-- 3) Moderação de avaliações
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.review_status as enum ('PENDENTE','APROVADO','REJEITADO');
exception when duplicate_object then null; end $$;

alter table public.reviews
  add column if not exists status public.review_status not null default 'PENDENTE',
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

-- Avaliações preexistentes entram como PENDENTE: o Super Admin decide o que
-- se torna público na área de moderação (nenhuma avaliação é apagada).

-- ---------------------------------------------------------------------------
-- 4) Correção de cidade dos pontos de embarque (fonte: boarding_points)
-- ---------------------------------------------------------------------------
update public.boarding_points
set address = 'Cajamar - SP'
where (name = 'Anhanguera Parque Shopping' or name ilike '%Polvilho%')
  and address is distinct from 'Cajamar - SP';

commit;