-- Aplique este arquivo em projetos Supabase que já executaram database/schema.sql.
-- Ele não migra dados nem a store local; apenas endurece RLS e papéis.

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
drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation before update on public.profiles for each row execute procedure public.prevent_profile_privilege_escalation();

drop policy if exists profiles_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_self on public.profiles for select using(id=auth.uid() or is_admin() or is_financial() or is_operational());
create policy profiles_update_self on public.profiles for update using(id=auth.uid() or is_admin()) with check(id=auth.uid() or is_admin());

drop policy if exists trips_staff_write on public.trips;
drop policy if exists trips_admin_write on public.trips;
create policy trips_admin_write on public.trips for all using(is_admin()) with check(is_admin());

drop policy if exists images_staff on public.trip_images;
drop policy if exists images_admin on public.trip_images;
create policy images_admin on public.trip_images for all using(is_admin()) with check(is_admin());
drop policy if exists bp_staff on public.boarding_points;
drop policy if exists bp_admin on public.boarding_points;
create policy bp_admin on public.boarding_points for all using(is_admin()) with check(is_admin());
drop policy if exists tbp_staff on public.trip_boarding_points;
drop policy if exists tbp_admin on public.trip_boarding_points;
create policy tbp_admin on public.trip_boarding_points for all using(is_admin()) with check(is_admin());

drop policy if exists settings_read on public.settings;
drop policy if exists settings_write on public.settings;
create policy settings_read on public.settings for select using(key='brand' or is_admin() or is_financial());
create policy settings_write on public.settings for all using(is_admin()) with check(is_admin());

drop policy if exists checkin_staff on public.checkins;
create policy checkin_staff on public.checkins for all using(is_admin() or is_operational()) with check(is_admin() or is_operational());
