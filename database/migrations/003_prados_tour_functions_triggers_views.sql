-- Prado's Tour / Supabase
-- ETAPA 2: funções, triggers e views.
-- Pré-requisito: 002_prados_tour_ddl.sql aplicado com sucesso.

-- Supabase Auth permanece a autoridade de usuários. Esta função apenas cria
-- o perfil correspondente quando um novo usuário Auth for criado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(
    id, full_name, cpf, birth_date, email, phone, whatsapp
  )
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', 'Cliente'),
    coalesce(new.raw_user_meta_data->>'cpf', concat('PENDING-', new.id::text)),
    nullif(new.raw_user_meta_data->>'nascimento', '')::date,
    new.email,
    new.raw_user_meta_data->>'telefone',
    new.raw_user_meta_data->>'whatsapp'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_role(r public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = r);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN','ADMIN','FINANCEIRO','VENDEDOR','MONITOR')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('SUPER_ADMIN','ADMIN')
  );
$$;

create or replace function public.is_financial()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('SUPER_ADMIN','ADMIN','FINANCEIRO')
  );
$$;

create or replace function public.is_operational()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('SUPER_ADMIN','ADMIN','MONITOR')
  );
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and not exists(
       select 1 from public.profiles
       where id = auth.uid() and role in ('SUPER_ADMIN','ADMIN')
     ) then
    raise exception 'ROLE_CHANGE_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

-- Função transacional mantida compatível com a assinatura já prevista no
-- schema atual. O adaptador da aplicação ainda não a utiliza; não há alteração
-- no fluxo local de reservas nesta etapa.
create or replace function public.create_booking(
  p_trip uuid,
  p_qty int,
  p_method public.payment_method,
  p_plan public.payment_plan,
  p_full_name text,
  p_phone text,
  p_boarding text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_base numeric;
  v_total numeric;
  v_discount numeric := 0;
  v_ref text;
  v_booking uuid;
  v_initial numeric;
  v_balance numeric;
begin
  if v_user is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_qty < 1 then raise exception 'INVALID_QUANTITY'; end if;

  select * into v_trip
  from public.trips
  where id = p_trip
  for update;

  if not found or v_trip.status <> 'PUBLICADA' then
    raise exception 'TRIP_UNAVAILABLE';
  end if;
  if v_trip.date < current_date then raise exception 'TRIP_DATE_INVALID'; end if;
  if (
    select count(*)
    from public.booking_passengers bp
    join public.bookings b on b.id = bp.booking_id
    where b.trip_id = p_trip and b.status in ('PENDENTE','CONFIRMADA')
  ) + p_qty > v_trip.total_seats then
    raise exception 'NO_VACANCY';
  end if;

  v_base := floor(p_qty / 2) * coalesce(v_trip.price_couple, v_trip.price_person * 2)
    + (p_qty % 2) * v_trip.price_person;
  v_total := v_base;
  if p_method = 'PIX' and p_plan = 'TOTAL' then
    v_discount := round(v_base * 0.02, 2);
    v_total := v_base - v_discount;
  end if;

  v_ref := 'PT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.bookings(
    reference, customer_id, trip_id, quantity, boarding_point,
    total_amount, base_amount, discount_amount, payment_plan, status
  ) values(
    v_ref, v_user, p_trip, p_qty, p_boarding,
    v_total, v_base, v_discount, p_plan, 'PENDENTE'
  ) returning id into v_booking;

  insert into public.booking_passengers(booking_id, name, phone, travel_together)
  values(v_booking, p_full_name, p_phone, true);

  v_initial := case when p_plan = 'TOTAL' then v_total else round(v_total / 2, 2) end;
  v_balance := v_total - v_initial;

  insert into public.payments(
    booking_id, customer_id, method, plan, amount, status, net_amount, metadata
  ) values(
    v_booking, v_user, p_method, p_plan, v_initial, 'PENDENTE', v_initial,
    jsonb_build_object('pix_manual', p_method = 'PIX')
  );

  insert into public.payment_installments(
    booking_id, number, value, due_date, status, method
  ) values(v_booking, 1, v_initial, current_date, 'PENDENTE', p_method);

  if p_plan = 'PARCIAL' then
    insert into public.payment_installments(
      booking_id, number, value, due_date, status, method
    ) values(v_booking, 2, v_balance, v_trip.date - 7, 'PENDENTE', p_method);
  end if;

  insert into public.notifications(user_id, title, message, type)
  values(
    v_user,
    'Reserva criada',
    'Sua reserva ' || v_ref || ' foi criada e está aguardando pagamento.',
    'RESERVA'
  );
  return v_booking;
end;
$$;

grant execute on function public.create_booking(
  uuid, int, public.payment_method, public.payment_plan, text, text, text
) to authenticated;

create or replace view public.admin_dashboard
with (security_invoker = true)
as select
  (select coalesce(sum(amount), 0) from public.payments where status = 'PAGO') revenue,
  (select count(*) from public.bookings) sales,
  (select count(*) from public.bookings) bookings,
  (select count(*) from public.booking_passengers) passengers,
  (select count(*) from public.trips) trips,
  (select coalesce(sum(total_seats), 0) - coalesce((select count(*) from public.booking_passengers), 0) from public.trips) seats,
  (select count(*) from public.payments where status = 'PENDENTE') pending_payments,
  (select coalesce(sum(amount), 0) from public.commissions) commissions,
  (select coalesce(sum(amount), 0) from public.payments where status = 'PAGO')
    - (select coalesce(sum(amount), 0) from public.expenses)
    - (select coalesce(sum(amount), 0) from public.commissions) profit;

create or replace view public.financial_summary
with (security_invoker = true)
as select
  (select coalesce(sum(amount), 0) from public.payments where status = 'PAGO') revenue,
  (select coalesce(sum(amount), 0) from public.expenses) expenses,
  (select coalesce(sum(fee_amount), 0) from public.payments) fees,
  (select coalesce(sum(amount), 0) from public.commissions) commissions,
  (select coalesce(sum(net_amount), 0) from public.payments where status = 'PAGO') net,
  (select coalesce(sum(amount), 0) from public.payments where status = 'PAGO')
    - (select coalesce(sum(amount), 0) from public.expenses)
    - (select coalesce(sum(amount), 0) from public.commissions) profit;

create or replace view public.seller_dashboard
with (security_invoker = true)
as select
  p.id,
  (select count(*) from public.bookings b where b.seller_id = p.id) sales,
  (select coalesce(sum(b.total_amount), 0) from public.bookings b where b.seller_id = p.id) total_sold,
  (select coalesce(sum(c.amount), 0) from public.commissions c where c.seller_id = p.id) commission_generated,
  (select coalesce(sum(c.amount), 0) from public.commissions c where c.seller_id = p.id and c.status = 'PAGA') commission_paid,
  (select count(distinct b.customer_id) from public.bookings b where b.seller_id = p.id) customers
from public.profiles p
where p.id = auth.uid();

create or replace view public.operational_trips
with (security_invoker = true)
as select
  t.*,
  (select count(*) from public.booking_passengers bp join public.bookings b on b.id = bp.booking_id where b.trip_id = t.id) passenger_count,
  (select count(*) from public.checkins c join public.bookings b on b.id = c.booking_id where b.trip_id = t.id) checkins
from public.trips t
where public.is_staff();
