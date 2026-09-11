-- Mover helpers SECURITY DEFINER para schema privado (nao exposto pela API),
-- preservando EXECUTE para os roles que as policies RLS avaliam (anon/authenticated).
-- A relocacao (e nao o revoke) fecha o /rest/v1/rpc; revoke quebraria as policies.
create schema if not exists private;

alter function public.is_admin() set schema private;
alter function public.is_financial() set schema private;
alter function public.is_operational() set schema private;
alter function public.is_staff() set schema private;

-- ACLs: mantem EXECUTE apenas para quem as policies precisam
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_financial() to anon, authenticated;
grant execute on function private.is_operational() to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;

revoke execute on function private.is_admin() from public;
revoke execute on function private.is_financial() from public;
revoke execute on function private.is_operational() from public;
revoke execute on function private.is_staff() from public;