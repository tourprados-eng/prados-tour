create extension if not exists pgcrypto;
create type public.app_role as enum ('SUPER_ADMIN','ADMIN','FINANCEIRO','VENDEDOR','MONITOR','CLIENTE');
create type public.trip_status as enum ('RASCUNHO','PUBLICADA','ESGOTADA','CANCELADA','FINALIZADA');
create type public.booking_status as enum ('PENDENTE','CONFIRMADA','CANCELADA','CONCLUIDA');
create type public.payment_status as enum ('PENDENTE','PAGO','ESTORNADO','CANCELADO','ATRASADO');
create type public.payment_method as enum ('PIX','CARTAO');
create type public.payment_plan as enum ('TOTAL','PARCIAL');
create type public.installment_status as enum ('PENDENTE','PAGO','ATRASADO','CANCELADO');
create type public.commission_status as enum ('PENDENTE','APROVADA','PAGA','CANCELADA');
create type public.customer_class as enum ('NOVO','RECORRENTE','VIP','INATIVO');
create type public.coupon_type as enum ('PERCENTUAL','FIXO');

create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, cpf text not null unique, birth_date date, email text not null unique, phone text, whatsapp text,
 role public.app_role not null default 'CLIENTE', customer_class public.customer_class default 'NOVO', referral_code text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.trips(
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, destination text not null,
 category text not null check(category in('PRAIA','PARQUE','CIDADE_TURISMO','NATUREZA','OUTROS')),
 date date not null, departure_date date, departure_time time, return_time time, price_person numeric(12,2) not null check(price_person>=0), price_couple numeric(12,2), total_seats int not null check(total_seats>0),
 description text, itinerary text, included text, not_included text, rules text, cancellation_policy text, form_url text, form_required boolean not null default false, status public.trip_status not null default 'RASCUNHO',
 deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.trip_images(id uuid primary key default gen_random_uuid(),trip_id uuid references public.trips(id) on delete cascade,url text not null,sort_order int default 0);
create table public.boarding_points(id uuid primary key default gen_random_uuid(),name text not null,address text,latitude numeric,longitude numeric,observations text,active boolean not null default true);
create table public.trip_boarding_points(id uuid primary key default gen_random_uuid(),trip_id uuid references public.trips(id) on delete cascade,boarding_point_id uuid references public.boarding_points(id),time time,unique(trip_id,boarding_point_id));
create table public.seats(id uuid primary key default gen_random_uuid(),trip_id uuid references public.trips(id) on delete cascade,seat_number text not null,state text not null default 'DISPONIVEL' check(state in('DISPONIVEL','SELECIONADO','OCUPADO','BLOQUEADO')),booking_id uuid,unique(trip_id,seat_number));
create table public.sellers(id uuid primary key references public.profiles(id) on delete cascade,code text unique not null,commission_rate numeric(6,4) default 0.10);
create table public.bookings(
 id uuid primary key default gen_random_uuid(), reference text not null unique, customer_id uuid not null references public.profiles(id), trip_id uuid not null references public.trips(id), seller_id uuid references public.sellers(id),
 quantity int not null check(quantity>0), boarding_point_id uuid references public.boarding_points(id), boarding_point text, total_amount numeric(12,2) not null check(total_amount>=0), base_amount numeric(12,2) not null check(base_amount>=0), discount_amount numeric(12,2) default 0, coupon_code text,
 payment_plan public.payment_plan not null, status public.booking_status not null default 'PENDENTE', notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.seats add constraint seats_booking_fk foreign key(booking_id) references public.bookings(id) on delete set null;
create table public.booking_passengers(id uuid primary key default gen_random_uuid(),booking_id uuid references public.bookings(id) on delete cascade,name text not null,cpf text,birth_date date,phone text,seat_id uuid references public.seats(id),boarding_point_id uuid references public.boarding_points(id),seat_group text,seat_assignment_status text not null default 'PENDENTE' check(seat_assignment_status in('PENDENTE','ATRIBUIDO','MANUAL')),travel_together boolean default true,group_id uuid,group_name text,observations text);
create table public.payments(id uuid primary key default gen_random_uuid(),booking_id uuid references public.bookings(id) on delete cascade,customer_id uuid references public.profiles(id),method public.payment_method,plan public.payment_plan,amount numeric(12,2) not null,status public.payment_status not null default 'PENDENTE',gateway text,gateway_payment_id text,fee_amount numeric(12,2) default 0,net_amount numeric(12,2),paid_at timestamptz,pix_copy_paste text,metadata jsonb default '{}'::jsonb,created_at timestamptz default now());
create table public.payment_installments(id uuid primary key default gen_random_uuid(),booking_id uuid references public.bookings(id) on delete cascade,number int not null,value numeric(12,2) not null,due_date date not null,status public.installment_status not null default 'PENDENTE',paid_at timestamptz,method public.payment_method);
create table public.coupons(id uuid primary key default gen_random_uuid(),code text not null unique,type public.coupon_type not null,value numeric(12,2) not null,usage_limit int,valid_until timestamptz,active boolean not null default true);
create table public.coupon_trips(coupon_id uuid not null references public.coupons(id) on delete cascade,trip_id uuid not null references public.trips(id) on delete cascade,primary key(coupon_id,trip_id));
create table public.coupon_usages(id uuid primary key default gen_random_uuid(),coupon_id uuid references public.coupons(id),user_id uuid references public.profiles(id),booking_id uuid references public.bookings(id),created_at timestamptz default now(),unique(coupon_id,user_id,booking_id));
create table public.commissions(id uuid primary key default gen_random_uuid(),seller_id uuid references public.sellers(id),booking_id uuid references public.bookings(id),rate numeric(6,4) not null,amount numeric(12,2) not null,status public.commission_status default 'PENDENTE',paid_at timestamptz);
create table public.expenses(id uuid primary key default gen_random_uuid(),category text not null,amount numeric(12,2) not null,expense_date date not null,description text,trip_id uuid references public.trips(id),created_by uuid references public.profiles(id),created_at timestamptz default now());
create table public.checkins(id uuid primary key default gen_random_uuid(),booking_id uuid references public.bookings(id),passenger_id uuid references public.booking_passengers(id),checked_at timestamptz default now(),employee_id uuid references public.profiles(id),unique(passenger_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete cascade,title text not null,message text not null,type text,read boolean default false,created_at timestamptz default now());
create table public.reviews(id uuid primary key default gen_random_uuid(),customer_id uuid references public.profiles(id),trip_id uuid references public.trips(id),rating int check(rating between 1 and 5),comment text,created_at timestamptz default now(),unique(customer_id,trip_id));
create table public.loyalty_points(id uuid primary key default gen_random_uuid(),customer_id uuid references public.profiles(id),points int not null,source text,booking_id uuid references public.bookings(id),created_at timestamptz default now());
create table public.referrals(id uuid primary key default gen_random_uuid(),referrer_id uuid references public.profiles(id),referred_id uuid references public.profiles(id),code text not null,created_at timestamptz default now(),unique(referrer_id,referred_id));
create table public.settings(key text primary key,value jsonb not null default '{}'::jsonb,updated_at timestamptz default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id),action text not null,entity text,entity_id text,old_value jsonb,new_value jsonb,ip text,created_at timestamptz default now());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,cpf,birth_date,email,phone,whatsapp) values(new.id,coalesce(new.raw_user_meta_data->>'nome',''),coalesce(new.raw_user_meta_data->>'cpf',concat('PENDING-',new.id::text)),nullif(new.raw_user_meta_data->>'nascimento','')::date,new.email,new.raw_user_meta_data->>'telefone',new.raw_user_meta_data->>'whatsapp'); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.has_role(r public.app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role=r); $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in('SUPER_ADMIN','ADMIN','FINANCEIRO','VENDEDOR','MONITOR')); $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in('SUPER_ADMIN','ADMIN')); $$;
create or replace function public.is_financial() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in('SUPER_ADMIN','ADMIN','FINANCEIRO')); $$;
create or replace function public.is_operational() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in('SUPER_ADMIN','ADMIN','MONITOR')); $$;
create or replace function public.prevent_profile_privilege_escalation() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.role is distinct from new.role and not exists(select 1 from public.profiles where id=auth.uid() and role in('SUPER_ADMIN','ADMIN')) then
   raise exception 'ROLE_CHANGE_NOT_ALLOWED';
 end if;
 return new;
end;
$$;
create trigger profiles_prevent_privilege_escalation before update on public.profiles for each row execute procedure public.prevent_profile_privilege_escalation();

alter table public.profiles enable row level security; alter table public.trips enable row level security; alter table public.trip_images enable row level security; alter table public.boarding_points enable row level security; alter table public.trip_boarding_points enable row level security; alter table public.seats enable row level security; alter table public.bookings enable row level security; alter table public.booking_passengers enable row level security; alter table public.payments enable row level security; alter table public.payment_installments enable row level security; alter table public.coupons enable row level security; alter table public.coupon_trips enable row level security; alter table public.coupon_usages enable row level security; alter table public.sellers enable row level security; alter table public.commissions enable row level security; alter table public.expenses enable row level security; alter table public.checkins enable row level security; alter table public.notifications enable row level security; alter table public.reviews enable row level security; alter table public.loyalty_points enable row level security; alter table public.referrals enable row level security; alter table public.settings enable row level security; alter table public.audit_logs enable row level security;

create policy profiles_self on profiles for select using(id=auth.uid() or is_admin() or is_financial() or is_operational()); create policy profiles_update_self on profiles for update using(id=auth.uid() or is_admin()) with check(id=auth.uid() or is_admin());
create policy trips_public on trips for select using((status='PUBLICADA' and deleted_at is null) or is_staff()); create policy trips_admin_write on trips for all using(is_admin()) with check(is_admin());
create policy images_public on trip_images for select using(exists(select 1 from trips t where t.id=trip_id and ((t.status='PUBLICADA' and t.deleted_at is null) or is_staff()))); create policy images_admin on trip_images for all using(is_admin()) with check(is_admin());
create policy bp_public on boarding_points for select using(active or is_staff()); create policy bp_admin on boarding_points for all using(is_admin()) with check(is_admin());
create policy tbp_public on trip_boarding_points for select using(exists(select 1 from trips t where t.id=trip_id and ((t.status='PUBLICADA' and t.deleted_at is null) or is_staff()))); create policy tbp_admin on trip_boarding_points for all using(is_admin()) with check(is_admin());
create policy seats_admin on seats for all using(is_admin()) with check(is_admin()); create policy seats_client_select on seats for select using(exists(select 1 from bookings b where b.id=booking_id and b.customer_id=auth.uid()));
create policy bookings_client on bookings for select using(customer_id=auth.uid() or is_admin() or is_financial() or is_operational() or seller_id=auth.uid()); create policy bookings_insert on bookings for insert with check(customer_id=auth.uid() or is_admin()); create policy bookings_staff_update on bookings for update using(is_admin() or is_financial()) with check(is_admin() or is_financial());
create policy passengers_client on booking_passengers for select using(exists(select 1 from bookings b where b.id=booking_id and (b.customer_id=auth.uid() or is_admin() or is_financial() or is_operational() or b.seller_id=auth.uid()))); create policy passengers_insert on booking_passengers for insert with check(exists(select 1 from bookings b where b.id=booking_id and (b.customer_id=auth.uid() or is_admin()))); create policy passengers_staff_update on booking_passengers for update using(is_admin() or is_operational() or exists(select 1 from bookings b where b.id=booking_id and b.customer_id=auth.uid())) with check(is_admin() or is_operational() or exists(select 1 from bookings b where b.id=booking_id and b.customer_id=auth.uid()));
create policy payments_client on payments for select using(customer_id=auth.uid() or is_admin() or is_financial()); create policy installments_client on payment_installments for select using(exists(select 1 from bookings b where b.id=booking_id and (b.customer_id=auth.uid() or is_admin() or is_financial()))); create policy payments_staff_write on payments for all using(is_admin() or is_financial()) with check(is_admin() or is_financial()); create policy installments_staff_write on payment_installments for all using(is_admin() or is_financial()) with check(is_admin() or is_financial());
create policy coupons_public on coupons for select using(active=true); create policy coupons_staff on coupons for all using(is_staff()) with check(is_staff()); create policy coupon_trips_public on coupon_trips for select using(exists(select 1 from coupons c where c.id=coupon_id and c.active=true) or is_staff()); create policy coupon_trips_staff on coupon_trips for all using(is_staff()) with check(is_staff()); create policy coupon_usage_staff on coupon_usages for all using(is_staff() or user_id=auth.uid()) with check(is_staff() or user_id=auth.uid());
create policy seller_self on sellers for select using(id=auth.uid() or is_admin() or is_financial()); create policy seller_admin on sellers for all using(is_admin()) with check(is_admin()); create policy commission_seller on commissions for select using(seller_id=auth.uid() or is_admin() or is_financial()); create policy commission_staff on commissions for all using(is_admin() or is_financial()) with check(is_admin() or is_financial());
create policy expense_financial on expenses for all using(is_financial()) with check(is_financial());
create policy checkin_staff on checkins for all using(is_admin() or is_operational()) with check(is_admin() or is_operational()); create policy notif_self on notifications for select using(user_id=auth.uid() or is_admin() or is_financial()); create policy notif_staff on notifications for insert with check(is_admin() or is_financial() or is_operational());
create policy reviews_self on reviews for select using(customer_id=auth.uid() or is_staff()); create policy reviews_insert on reviews for insert with check(customer_id=auth.uid()); create policy loyalty_self on loyalty_points for select using(customer_id=auth.uid() or is_staff()); create policy referrals_self on referrals for select using(referrer_id=auth.uid() or referred_id=auth.uid() or is_staff()); create policy referral_insert on referrals for insert with check(referrer_id=auth.uid());
create policy settings_read on settings for select using(key='brand' or is_admin() or is_financial()); create policy settings_write on settings for all using(is_admin()) with check(is_admin()); create policy audit_staff on audit_logs for select using(is_admin() or is_financial()); create policy audit_insert on audit_logs for insert with check(is_admin() or is_financial());

create or replace view public.admin_dashboard with (security_invoker = true) as select
 (select coalesce(sum(amount),0) from payments where status='PAGO') revenue,
 (select count(*) from bookings) sales,(select count(*) from bookings) bookings,(select count(*) from booking_passengers) passengers,
 (select count(*) from trips) trips,(select coalesce(sum(total_seats),0)-coalesce((select count(*) from booking_passengers),0) from trips) seats,
 (select count(*) from payments where status='PENDENTE') pending_payments,(select coalesce(sum(amount),0) from commissions) commissions,
 (select coalesce(sum(amount),0) from payments where status='PAGO')-(select coalesce(sum(amount),0) from expenses)-(select coalesce(sum(amount),0) from commissions) profit;
create or replace view public.financial_summary with (security_invoker = true) as select (select coalesce(sum(amount),0) from payments where status='PAGO') revenue,(select coalesce(sum(amount),0) from expenses) expenses,(select coalesce(sum(fee_amount),0) from payments) fees,(select coalesce(sum(amount),0) from commissions) commissions,(select coalesce(sum(net_amount),0) from payments where status='PAGO') net,(select coalesce(sum(amount),0) from payments where status='PAGO')-(select coalesce(sum(amount),0) from expenses)-(select coalesce(sum(amount),0) from commissions) profit;
create or replace view public.seller_dashboard with (security_invoker = true) as select p.id,(select count(*) from bookings b where b.seller_id=p.id) sales,(select coalesce(sum(b.total_amount),0) from bookings b where b.seller_id=p.id) total_sold,(select coalesce(sum(c.amount),0) from commissions c where c.seller_id=p.id) commission_generated,(select coalesce(sum(c.amount),0) from commissions c where c.seller_id=p.id and c.status='PAGA') commission_paid,(select count(distinct b.customer_id) from bookings b where b.seller_id=p.id) customers from profiles p where p.id=auth.uid();
create or replace view public.operational_trips with (security_invoker = true) as select t.*, (select count(*) from booking_passengers bp join bookings b on b.id=bp.booking_id where b.trip_id=t.id) passenger_count,(select count(*) from checkins c join bookings b on b.id=c.booking_id where b.trip_id=t.id) checkins from trips t where is_staff();

insert into public.settings(key,value) values('brand','{"company_name":"Prado''s Tour","primary":"#E84C91","secondary":"#F28C28","background":"#FFF9FC","font":"Arial","font_size":"16","whatsapp":"5511998639502","instagram":"","email":""}'::jsonb) on conflict(key) do nothing;
insert into public.settings(key,value) values('payment','{"pix_key":"11998639502","pix_total_discount":0.02,"card_whatsapp":true}'::jsonb) on conflict(key) do nothing;
create or replace function public.create_booking(p_trip uuid,p_qty int,p_method public.payment_method,p_plan public.payment_plan,p_full_name text,p_phone text,p_boarding text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_trip trips%rowtype; v_base numeric; v_total numeric; v_discount numeric:=0; v_ref text; v_booking uuid; v_initial numeric; v_balance numeric; v_customer text;
begin
 if v_user is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p_qty<1 then raise exception 'INVALID_QUANTITY'; end if;
 select * into v_trip from trips where id=p_trip for update;
 if not found or v_trip.status<>'PUBLICADA' or v_trip.deleted_at is not null then raise exception 'TRIP_UNAVAILABLE'; end if;
 if v_trip.date<current_date then raise exception 'TRIP_DATE_INVALID'; end if;
 if (select count(*) from booking_passengers bp join bookings b on b.id=bp.booking_id where b.trip_id=p_trip and b.status in('PENDENTE','CONFIRMADA')) + p_qty > v_trip.total_seats then raise exception 'NO_VACANCY'; end if;
 v_base:=floor(p_qty/2)*coalesce(v_trip.price_couple,v_trip.price_person*2)+(p_qty%2)*v_trip.price_person;
 v_total:=v_base;
 if p_method='PIX' and p_plan='TOTAL' then v_discount:=round(v_base*0.02,2); v_total:=v_base-v_discount; end if;
 v_ref:='PT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into bookings(reference,customer_id,trip_id,quantity,boarding_point,total_amount,base_amount,discount_amount,payment_plan,status) values(v_ref,v_user,p_trip,p_qty,p_boarding,v_total,v_base,v_discount,p_plan,'PENDENTE') returning id into v_booking;
 insert into booking_passengers(booking_id,name,phone,travel_together) values(v_booking,p_full_name,p_phone,true);
 v_initial:=case when p_plan='TOTAL' then v_total else round(v_total/2,2) end; v_balance:=v_total-v_initial;
 insert into payments(booking_id,customer_id,method,plan,amount,status,net_amount,metadata) values(v_booking,v_user,p_method,p_plan,v_initial,'PENDENTE',v_initial,jsonb_build_object('pix_manual',p_method='PIX'));
 insert into payment_installments(booking_id,number,value,due_date,status,method) values(v_booking,1,v_initial,current_date,'PENDENTE',p_method);
 if p_plan='PARCIAL' then insert into payment_installments(booking_id,number,value,due_date,status,method) values(v_booking,2,v_balance,v_trip.date-7,'PENDENTE',p_method); end if;
 insert into notifications(user_id,title,message,type) values(v_user,'Reserva criada','Sua reserva '||v_ref||' foi criada e está aguardando pagamento.','RESERVA');
 return v_booking;
end; $$;
grant execute on function public.create_booking(uuid,int,public.payment_method,public.payment_plan,text,text,text) to authenticated;
