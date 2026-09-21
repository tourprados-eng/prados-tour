-- Prado's Tour / Avaliações públicas
--
-- Permite que visitantes (sem login) avaliem uma viagem pela página inicial.
--   * author_name: nome exibido publicamente quando não há cliente autenticado;
--   * customer_id passa a ser opcional (avaliação pública não depende de login);
--   * toda avaliação nova nasce como PENDENTE e o Admin é quem aprova/rejeita.
--
-- IDEMPOTENTE (IF NOT EXISTS / drop not null) e segura para dados existentes.

begin;

alter table public.reviews
  add column if not exists author_name text;

-- Avaliações de visitantes não possuem perfil vinculado.
alter table public.reviews
  alter column customer_id drop not null;

-- Consulta pública filtra por status (APROVADO).
create index if not exists reviews_status_idx
  on public.reviews(status);

-- RLS: o público lê somente avaliações APROVADAS.
-- O cliente anônimo/autenticado só consegue INSERIR avaliação PENDENTE —
-- nunca publicada diretamente (a aprovação é ação protegida do Admin via
-- service role; estas policies protegem acessos diretos ao PostgREST).
create policy reviews_public_select on public.reviews
  for select to anon, authenticated
  using (status = 'APROVADO');

create policy reviews_public_insert on public.reviews
  for insert to anon, authenticated
  with check (
    status = 'PENDENTE'
    and rating between 1 and 5
    and (customer_id is null or customer_id = auth.uid())
    and author_name is not null
  );

commit;