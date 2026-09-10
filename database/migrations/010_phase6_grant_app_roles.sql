-- Prado's Tour / Supabase
-- ETAPA 3: GRANTs mínimos de operação para o app.
--
-- CONTEXTO
--   As migrations de DDL não emitiram GRANTs de tabela (exceto 006, só para
--   public.profiles/authenticated). Neste projeto os privilégios padrão do
--   Supabase não foram aplicados, então incluso a role `service_role` (usada
--   por todo o backend via getRepositoryRuntime) recebe "permission denied".
--
-- ESCOPO
--   - service_role: leitura e escrita em todas as tabelas/sequências (o app
--     acessa todo o banco por ela). RLS não se aplica a essa role no backend.
--   - anon/authenticated: somente SELECT nas tabelas; as policies de RLS
--     (viagens públicas, profile próprio etc.) continuam filtrando linhas.
--   - Default privileges para cobrir tabelas criadas futuramente.
--
-- IDEMPOTÊNCIA
--   GRANT não falha ao ser reexecutado.

begin;

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon, authenticated;
grant select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

commit;