-- Prado's Tour / Finalização das avaliações públicas
--
-- Complementa a 024_public_reviews.sql e garante segurança + idempotência:
--   * author_name: nome exibido publicamente para avaliações de visitantes
--     (sem login), aplicado em produção onde a coluna ainda não existe;
--   * customer_id passa a ser opcional (avaliação pública não depende de perfil);
--   * RLS: o público lê SOMENTE avaliações APROVADAS;
--   * RLS: inserção pública cria SOMENTE avaliação PENDENTE (nunca aprovada);
--   * remove a policy antiga (004) que permitia inserir com status arbitrário;
--   * aprovar/rejeitar/excluir passa a exigir is_admin() no nível do banco,
--     além da checagem SUPER_ADMIN já feita nas server actions (service role).

begin;

-- 1) Nome público para avaliações de visitantes (idempotente).
alter table public.reviews
  add column if not exists author_name text;

-- 2) Avaliações públicas não exigem perfil vinculado.
alter table public.reviews
  alter column customer_id drop not null;

-- 3) Consulta pública por status (rápida para a Home).
create index if not exists reviews_status_idx
  on public.reviews(status);

-- 4) Leitura pública: somente APROVADO (anon + authenticated).
drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select on public.reviews
  for select to anon, authenticated
  using (status = 'APROVADO');

-- 5) Inserção pública: sempre PENDENTE e com validação mínima no banco.
--    O status é imposto pelo servidor e pela policy — o navegador nunca
--    escolhe para onde a avaliação vai.
drop policy if exists reviews_public_insert on public.reviews;
create policy reviews_public_insert on public.reviews
  for insert to anon, authenticated
  with check (
    status = 'PENDENTE'
    and rating between 1 and 5
    and (customer_id is null or customer_id = auth.uid())
    and length(trim(author_name)) > 0
  );

-- 6) Remove a policy antiga que permitia ao cliente autenticado inserir
--    avaliação com status livre (inclusive 'APROVADO') via PostgREST.
drop policy if exists reviews_insert on public.reviews;

-- 7) Moderação protegida: apenas ADMIN (SUPER_ADMIN/ADMIN) pode
--    aprovar/rejeitar/excluir diretamente no banco. Os helpers RLS vivem no
--    schema private (014_harden_rls_helpers_private_schema.sql).
drop policy if exists reviews_staff_update on public.reviews;
create policy reviews_staff_update on public.reviews
  for update using (private.is_admin()) with check (private.is_admin());

drop policy if exists reviews_staff_delete on public.reviews;
create policy reviews_staff_delete on public.reviews
  for delete using (private.is_admin());

-- 8) Mantém reviews_self (o próprio cliente lê suas avaliações em qualquer
--    status); o anônimo continua vendo somente APROVADO (policy acima).

commit;