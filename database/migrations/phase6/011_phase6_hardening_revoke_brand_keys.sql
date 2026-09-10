-- Prado's Tour / Supabase
-- ETAPA 3 (endurecimento): revogação de EXECUTE e limpeza das chaves brand.
--
-- 1) Funções SECURITY DEFINER que o app NÃO chama via /rest/v1/rpc (todas as
--    operações usam a role service_role). Mantém EXECUTE apenas para
--    is_admin/is_financial/is_operational/is_staff, exigidas pelas policies
--    de RLS (004) para os roles anon/authenticated. As revogadas são usadas
--    somente por triggers (handle_new_user, prevent_profile_privilege_escalation,
--    rls_auto_enable) ou são legadas não utilizadas (create_booking, has_role).
--    Trigger continua disparando normalmente: o privilégio é verificado no
--    CREATE TRIGGER, não a cada chamada.
--
-- 2) settings.brand: remove as chaves camelCase criadas pontualmente
--    (fontSize/faviconUrl), mantendo o padrão snake_case canônico que o
--    supabase-store grava via rowToSnakeCase e normaliza na leitura.

begin;

revoke all on function public.create_booking(
  uuid, int, public.payment_method, public.payment_plan, text, text, text
) from public, anon, authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_role(r public.app_role) from public, anon, authenticated;
revoke all on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

update public.settings
set value = (value - 'fontSize') - 'faviconUrl'
where key = 'brand';

commit;