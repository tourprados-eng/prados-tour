-- Política de gratuidade infantil específica por viagem.
alter table public.trips
  add column if not exists child_under5_free_with_two_adults boolean
    not null default false;
