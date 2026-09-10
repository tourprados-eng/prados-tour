-- Prado's Tour / Supabase
-- ETAPA 3: RLS, policies e permissões.
-- Pré-requisito: 002_prados_tour_ddl.sql e 003_prados_tour_functions_triggers_views.sql.

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_images enable row level security;
alter table public.boarding_points enable row level security;
alter table public.trip_boarding_points enable row level security;
alter table public.seats enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_passengers enable row level security;
alter table public.payments enable row level security;
alter table public.payment_installments enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_trips enable row level security;
alter table public.coupon_usages enable row level security;
alter table public.sellers enable row level security;
alter table public.commissions enable row level security;
alter table public.expenses enable row level security;
alter table public.checkins enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.loyalty_points enable row level security;
alter table public.referrals enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self on public.profiles
  for select using(id = auth.uid() or public.is_admin() or public.is_financial() or public.is_operational());
create policy profiles_update_self on public.profiles
  for update using(id = auth.uid() or public.is_admin())
  with check(id = auth.uid() or public.is_admin());

create policy trips_public on public.trips
  for select using(status = 'PUBLICADA' or public.is_staff());
create policy trips_admin_write on public.trips
  for all using(public.is_admin()) with check(public.is_admin());

create policy images_public on public.trip_images
  for select using(exists(
    select 1 from public.trips t
    where t.id = trip_id and (t.status = 'PUBLICADA' or public.is_staff())
  ));
create policy images_admin on public.trip_images
  for all using(public.is_admin()) with check(public.is_admin());

create policy bp_public on public.boarding_points
  for select using(active or public.is_staff());
create policy bp_admin on public.boarding_points
  for all using(public.is_admin()) with check(public.is_admin());

create policy tbp_public on public.trip_boarding_points
  for select using(exists(
    select 1 from public.trips t
    where t.id = trip_id and (t.status = 'PUBLICADA' or public.is_staff())
  ));
create policy tbp_admin on public.trip_boarding_points
  for all using(public.is_admin()) with check(public.is_admin());

create policy seats_admin on public.seats
  for all using(public.is_admin()) with check(public.is_admin());
create policy seats_client_select on public.seats
  for select using(exists(
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
  ));

create policy bookings_client on public.bookings
  for select using(
    customer_id = auth.uid() or public.is_admin() or public.is_financial()
    or public.is_operational() or seller_id = auth.uid()
  );
create policy bookings_insert on public.bookings
  for insert with check(customer_id = auth.uid() or public.is_admin());
create policy bookings_staff_update on public.bookings
  for update using(public.is_admin() or public.is_financial())
  with check(public.is_admin() or public.is_financial());

create policy passengers_client on public.booking_passengers
  for select using(exists(
    select 1 from public.bookings b
    where b.id = booking_id and (
      b.customer_id = auth.uid() or public.is_admin() or public.is_financial()
      or public.is_operational() or b.seller_id = auth.uid()
    )
  ));
create policy passengers_insert on public.booking_passengers
  for insert with check(exists(
    select 1 from public.bookings b
    where b.id = booking_id and (b.customer_id = auth.uid() or public.is_admin())
  ));
create policy passengers_staff_update on public.booking_passengers
  for update using(
    public.is_admin() or public.is_operational()
    or exists(select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
  ) with check(
    public.is_admin() or public.is_operational()
    or exists(select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
  );

create policy payments_client on public.payments
  for select using(customer_id = auth.uid() or public.is_admin() or public.is_financial());
create policy installments_client on public.payment_installments
  for select using(exists(
    select 1 from public.bookings b
    where b.id = booking_id and (b.customer_id = auth.uid() or public.is_admin() or public.is_financial())
  ));
create policy payments_staff_write on public.payments
  for all using(public.is_admin() or public.is_financial())
  with check(public.is_admin() or public.is_financial());
create policy installments_staff_write on public.payment_installments
  for all using(public.is_admin() or public.is_financial())
  with check(public.is_admin() or public.is_financial());

create policy coupons_public on public.coupons
  for select using(active = true);
create policy coupons_staff on public.coupons
  for all using(public.is_staff()) with check(public.is_staff());
create policy coupon_trips_public on public.coupon_trips
  for select using(exists(
    select 1 from public.coupons c
    where c.id = coupon_id and c.active = true
  ) or public.is_staff());
create policy coupon_trips_staff on public.coupon_trips
  for all using(public.is_staff()) with check(public.is_staff());
create policy coupon_usage_staff on public.coupon_usages
  for all using(public.is_staff() or user_id = auth.uid())
  with check(public.is_staff() or user_id = auth.uid());

create policy seller_self on public.sellers
  for select using(id = auth.uid() or public.is_admin() or public.is_financial());
create policy seller_admin on public.sellers
  for all using(public.is_admin()) with check(public.is_admin());
create policy commission_seller on public.commissions
  for select using(seller_id = auth.uid() or public.is_admin() or public.is_financial());
create policy commission_staff on public.commissions
  for all using(public.is_admin() or public.is_financial())
  with check(public.is_admin() or public.is_financial());

create policy expense_financial on public.expenses
  for all using(public.is_financial()) with check(public.is_financial());
create policy checkin_staff on public.checkins
  for all using(public.is_admin() or public.is_operational())
  with check(public.is_admin() or public.is_operational());
create policy notif_self on public.notifications
  for select using(user_id = auth.uid() or public.is_admin() or public.is_financial());
create policy notif_staff on public.notifications
  for insert with check(public.is_admin() or public.is_financial() or public.is_operational());

create policy reviews_self on public.reviews
  for select using(customer_id = auth.uid() or public.is_staff());
create policy reviews_insert on public.reviews
  for insert with check(customer_id = auth.uid());
create policy loyalty_self on public.loyalty_points
  for select using(customer_id = auth.uid() or public.is_staff());
create policy referrals_self on public.referrals
  for select using(referrer_id = auth.uid() or referred_id = auth.uid() or public.is_staff());
create policy referral_insert on public.referrals
  for insert with check(referrer_id = auth.uid());

create policy settings_read on public.settings
  for select using(key = 'brand' or public.is_admin() or public.is_financial());
create policy settings_write on public.settings
  for all using(public.is_admin()) with check(public.is_admin());
create policy audit_staff on public.audit_logs
  for select using(public.is_admin() or public.is_financial());
create policy audit_insert on public.audit_logs
  for insert with check(public.is_admin() or public.is_financial());
