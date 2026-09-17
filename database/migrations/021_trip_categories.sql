-- Prado's Tour — Categorias padronizadas de excursão
--
-- Categorias oficiais: PRAIA | PARQUE | CIDADE_TURISMO | NATUREZA | OUTROS.
-- Antes desta migração a coluna trips.category era texto livre. Este script
-- converte os valores já gravados no banco para o novo conjunto fechado e
-- adiciona uma CHECK constraint para garantir integridade daqui em diante.
--
-- Mapeamento dos valores legados encontrados em produção:
--   'Praia'              -> 'PRAIA'
--   'Parque'             -> 'PARQUE'
--   'Day Use'            -> 'PARQUE'
--   'Turismo religioso'  -> 'CIDADE_TURISMO'
--   'Turismo cultural'   -> 'CIDADE_TURISMO'
--   'Rota dos vinhos'    -> 'NATUREZA'
--   'Cachoeira'          -> 'NATUREZA'
--   'Trilha'             -> 'NATUREZA'
--   'Outros'             -> 'OUTROS'
--   qualquer outro valor -> 'OUTROS'  (nenhuma viagem fica com categoria vazia)
--
-- IDEMPOTENTE: o UPDATE reaplica o mesmo resultado; a constraint é
-- drop/recriada de forma determinística.

begin;

-- ---------------------------------------------------------------------------
-- 1) Padroniza os valores legados para o conjunto fechado.
-- ---------------------------------------------------------------------------
update public.trips
set category = case lower(trim(category))
  when 'praia' then 'PRAIA'
  when 'parque' then 'PARQUE'
  when 'day use' then 'PARQUE'
  when 'turismo religioso' then 'CIDADE_TURISMO'
  when 'turismo cultural' then 'CIDADE_TURISMO'
  when 'rota dos vinhos' then 'NATUREZA'
  when 'cachoeira' then 'NATUREZA'
  when 'trilha' then 'NATUREZA'
  when 'outros' then 'OUTROS'
  else 'OUTROS'
end
where category is distinct from (
  case lower(trim(category))
    when 'praia' then 'PRAIA'
    when 'parque' then 'PARQUE'
    when 'day use' then 'PARQUE'
    when 'turismo religioso' then 'CIDADE_TURISMO'
    when 'turismo cultural' then 'CIDADE_TURISMO'
    when 'rota dos vinhos' then 'NATUREZA'
    when 'cachoeira' then 'NATUREZA'
    when 'trilha' then 'NATUREZA'
    when 'outros' then 'OUTROS'
    else 'OUTROS'
  end
);

-- ---------------------------------------------------------------------------
-- 2) Constraint que garante o conjunto fechado daqui para frente.
-- ---------------------------------------------------------------------------
alter table public.trips
  drop constraint if exists trips_category_check;

alter table public.trips
  add constraint trips_category_check
  check (category in ('PRAIA', 'PARQUE', 'CIDADE_TURISMO', 'NATUREZA', 'OUTROS'));

commit;