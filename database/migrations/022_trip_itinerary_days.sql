alter table public.trips
add column if not exists itinerary_days jsonb not null default '[]'::jsonb;
