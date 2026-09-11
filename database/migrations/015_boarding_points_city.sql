begin;

alter table public.boarding_points
  add column if not exists city text;

update public.boarding_points
set city = case
  when name = 'SAN Fazendinha' then 'Santana de Parnaíba'
  when name = 'Anhanguera Parque Shopping' then 'Cajamar'
  when name = 'Ginásio de Esportes do Polvilho' then 'Cajamar'
  when name = 'Barra Funda' then 'São Paulo'
  else city
end
where name in (
  'SAN Fazendinha',
  'Anhanguera Parque Shopping',
  'Ginásio de Esportes do Polvilho',
  'Barra Funda'
);

commit;
