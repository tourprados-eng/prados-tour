-- FASE 6 - VALIDAÇÃO pós-execução da ETAPA 1 (somente SELECT, não altera nada).
-- Rode no SQL Editor e cole a saída de volta para conferirmos o catálogo
-- antes da Etapa 2 (dados de negócio).

\echo EXPEC: settings=2 trips=2 trip_images=2 boarding_points=4 trip_boarding_points=5 coupons=1 coupon_trips=0 seats=86

select 'settings' as tabela, count(*) as qtd from public.settings
union all select 'trips', count(*) from public.trips
union all select 'trip_images', count(*) from public.trip_images
union all select 'boarding_points', count(*) from public.boarding_points
union all select 'trip_boarding_points', count(*) from public.trip_boarding_points
union all select 'coupons', count(*) from public.coupons
union all select 'coupon_trips', count(*) from public.coupon_trips
union all select 'seats', count(*) from public.seats
order by tabela;

\echo --- trips ---
select slug, name, status, date, total_seats, price_person, price_couple from public.trips order by date;

\echo --- trip_images ---
select t.slug, i.url, i.sort_order from public.trip_images i join public.trips t on t.id = i.trip_id order by t.slug, i.sort_order;

\echo --- boarding_points ---
select name, address from public.boarding_points order by name;

\echo --- trip_boarding_points ---
select t.slug, bp.name, x.time from public.trip_boarding_points x
  join public.trips t on t.id = x.trip_id
  join public.boarding_points bp on bp.id = x.boarding_point_id
  order by t.slug, x.time;

\echo --- coupons (valores esperados: PRADOS10 PERCENTUAL 10 limite 100 ativo true) ---
select code, type, value, usage_limit, active, valid_until from public.coupons;

\echo --- seats por estado (esperado: DISPONIVEL=86, nenhum com booking_id) ---
select state, count(*) from public.seats group by state order by state;
select 'seats_com_booking' as checagem, count(*) from public.seats where booking_id is not null;

\echo --- settings brand (esperado rosa #E84C91 / laranja #F28C28) ---
select key, value from public.settings where key in ('brand','payment') order by key;

\echo --- checagens de integridade (todas devem retornar 0) ---
select 'trip_images_orfas' as checagem, count(*) from public.trip_images i left join public.trips t on t.id=i.trip_id where t.id is null
union all select 'tbp_orfos', count(*) from public.trip_boarding_points x left join public.trips t on t.id=x.trip_id where t.id is null
union all select 'tbp_ponto_orfao', count(*) from public.trip_boarding_points x left join public.boarding_points b on b.id=x.boarding_point_id where b.id is null
union all select 'seats_orfos', count(*) from public.seats s left join public.trips t on t.id=s.trip_id where t.id is null;