-- Prado's Tour / Avaliações — privilégios de tabela para RLS
--
-- As policies de RLS só valem para papéis que possuem privilégio de tabela.
-- Em produção, anon/authenticated tinham apenas SELECT; sem INSERT/UPDATE/DELETE
-- as policies reviews_public_insert / reviews_staff_update|delete nunca eram
-- avaliadas. Aqui garantimos os privilégios base; o controle de LINHAS continua
-- 100% com as policies (visitor só insere PENDENTE e lê APROVADO; apenas
-- is_admin() atualiza/exclui).

grant select, insert on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;