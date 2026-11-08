-- Night-light safety map schema, from the team brief.
-- Insert-only for anon: no policy lets the apps read rows back.
-- shortcut: the hotspots table, its trigger on incidents and street_scores were created in the
-- Supabase SQL editor on 8 Nov and are not in this file; add them here before reusing the schema.

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
