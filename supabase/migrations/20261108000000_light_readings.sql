-- Night-light safety map schema, from the team brief.
-- Replaces Leerie's migrations, whose demo_all policies were open to anyone.
-- Leerie's hazard clustering trigger (to adapt for hotspots) is in its repo at
-- supabase/migrations/20260901000000_init.sql, github.com/heechan02/Leerie.

create extension if not exists postgis;

create table light_readings (
  id bigint generated always as identity primary key,
  session_id uuid not null,          -- random per walk, not per person
  recorded_at timestamptz not null,
  location geography(point) not null,
  gps_accuracy_m real,
  speed_mps real,
  brightness real,                   -- exposure-corrected linear luminance, relative units
  iso real, exposure_s real, aperture real,
  device_model text
);
create index light_readings_location_idx on light_readings using gist (location);

create table incidents (
  id bigint generated always as identity primary key,
  session_id uuid,
  created_at timestamptz default now(),
  location geography(point) not null,
  gps_accuracy_m real,
  category text check (category in ('dark', 'followed', 'harassment', 'other'))
);

-- The app can add rows but never read them back. The pipeline reads with the service key.
alter table light_readings enable row level security;
alter table incidents enable row level security;
create policy "app can insert" on light_readings for insert to anon with check (true);
create policy "app can insert" on incidents for insert to anon with check (true);
