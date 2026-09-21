-- Prado's Tour / Avaliações — visibilidade na Home independente da aprovação
--
-- Adiciona `show_on_home` como estado separado do `status`:
--   * PENDENTE  → nunca aparece na Home;
--   * APROVADO + show_on_home = true  → aparece na Home;
--   * APROVADO + show_on_home = false → continua aprovada, mas "Oculta da Home";
--   * REJEITADO → nunca aparece na Home.
--
-- Coluna default FALSE para nada antigo/publicado automaticamente. As avaliações
-- já APROVADAS são marcadas como visíveis (preserva o comportamento atual da Home).

begin;

-- Campo equivalente ao show_on_home das gallery_photos (mesma semântica).
alter table public.reviews
  add column if not exists show_on_home boolean not null default false;

-- Preserva o comportamento atual: avaliações já aprovadas continuam visíveis.
update public.reviews
set show_on_home = true
where status = 'APROVADO' and show_on_home = false;

-- Consulta pública da Home filtra no banco: apenas aprovadas E visíveis.
drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select on public.reviews
  for select to anon, authenticated
  using (status = 'APROVADO' and show_on_home = true);

-- Índice para a consulta da Home / filtros do admin.
create index if not exists reviews_home_idx
  on public.reviews(status, show_on_home);

commit;