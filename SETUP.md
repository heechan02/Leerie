# Local setup

The dashboard uses exported files from `data/`. The scanner writes to hosted
Supabase; the pipeline reads Supabase and exports street summaries. No local
database, Docker containers, or Python web server are needed for this setup.

## Dashboard

```sh
cd dashboard
npm ci
npm run dev
```

Open http://localhost:3000 or http://localhost:3000/map.

## Pipeline

The root `.env` must contain `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
Keep the secret key on this machine; do not put it in the scanner or dashboard.

```sh
python3 -m pipeline.run       # refresh once
sh pipeline/live.sh          # refresh and copy dashboard data every minute
python3 -m pipeline.test_run
```

The optional lamp CSV importer requires pyproj:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r pipeline/requirements.txt
.venv/bin/python -m pipeline.lamps /path/to/Street_Lighting_Columns.csv
```

## Phone scanner

Install Flutter and run `flutter pub get` from `sensor/`. Its gitignored `.env`
contains `SUPABASE_URL` and the publishable key as `SUPABASE_ANON_KEY`.
Add a distinct `DEVICE_MODEL` value for each phone before collecting readings.

```sh
cd sensor
flutter doctor -v
flutter pub get
flutter run --release --dart-define-from-file=.env
```

iOS builds require the full Xcode application, its iOS platform support,
CocoaPods, and signing configured for the target device. Apple's Command Line
Tools alone cannot build the iOS app. Android builds require the Android SDK.

## Night timelapse

```sh
python3 -m pipeline.replay 2026-11-08
```

Open http://localhost:3000/replay (also linked from the map). This selects the
previous evening at 17:00 through the requested date at 06:30 UTC, filters GPS
quality, samples at ten-second intervals, and splits trails at gaps over
90 seconds. There is no reported or inferred speed limit. The recording currently uses Edinburgh's November GMT.
The replay preserves real elapsed time, including quiet periods.

The server reads the local, gitignored `.env.replay.json` snapshot. It contains
travel coordinates and times, so keep it private. It excludes session IDs, device
labels, and incident locations. A deployment needs this snapshot supplied
separately; it is not committed or placed in the public data directory.

For every Supabase light reading within the selected windows without GPS quality
or speed filtering, run `python3 -m pipeline.replay --raw` and open
`/replay?view=raw`. The snapshot retains original timestamps, coordinates and
GPS accuracy for every selected point.

## Selected recording windows

`data/recording_windows.json` is the shared source for the street map and both
replay modes. All three windows are on 8 November 2026, in Europe/London (GMT):
02:24:14–03:16:21, 03:53:55–04:52:05, and 05:32:00–06:22:00. End seconds are
inclusive, including fractional timestamps within that second. Readings and
reports outside these windows never enter aggregation; street estimates are
recomputed from the selected readings. Existing GPS quality rules remain for the street map and filtered replay.
There is no speed limit in either export. The all-GPS replay keeps every point
inside the windows, with each window represented as a separate trail.

After changing the windows, run `python3 -m pipeline.run`,
`python3 -m pipeline.replay 2026-11-08`, `python3 -m pipeline.replay --raw`, then
`node dashboard/scripts/copy-maplibre-worker.mjs`. The live pipeline loop also
uses this selection on every refresh. Replay snapshots remain local and private.

Map colours and lighting plans use the local light percentile (0–100), based on
nearby measured street segments within 75 m.
Reports remain visible as separate markers and in street hover details; they do
not change light scores. The map no longer has score-weight sliders.

## Local replay diagnostics

Run `python3 -m pipeline.replay_debug`, then open `/replay?view=raw` under
`npm run dev`. Diagnostics are enabled by default in development only. Hover
a replay line or point to inspect the nearest real recorded sample; click to
pause and pin the panel. Use **Show all points** to inspect the whole night.
The panel shows GPS accuracy, reported speed (no limit), brightness, exposure
metadata, nearest imported OSM street and distance, eligible readings and passes,
network extent, and all failed map inclusion checks. Refresh the diagnostic
snapshot after changing the selected windows, quality rules or imported network.
The snapshot is gitignored and is never passed to a production replay page.

## Reimport streets around all recorded travel

```sh
python3 -m pipeline.import_streets
# Optional: recrop the existing council CSV to the enlarged street extent:
.venv/bin/python -m pipeline.lamps /path/to/Street_Lighting_Columns.csv
python3 -m pipeline.run
python3 -m pipeline.replay_debug
node dashboard/scripts/copy-maplibre-worker.mjs
```

The importer uses **all** recorded locations, independently of the selected map
windows and quality filters, with a 500 m margin. It preserves the old map extent
and downloads every OSM highway way, including footways, steps, pedestrian
streets and service roads, with full geometry. It validates the entire response
and only replaces `data/osm_ways.json` after success. The query, source endpoint,
bounds and import time are recorded in that file's `leerie_import` metadata.
Map timestamps, GPS accuracy and minimum-reading requirements still apply after
reimport. The local hover diagnostics show any remaining point-level exclusions.

Production uses `NightReplay`; the local-only overlay lives in
`LocalNightReplay` and is imported only in development. Production browser assets
exclude its code and styles. The public-data copy step uses an explicit allowlist
and removes stale generated files before copying, so diagnostic JSON cannot be
published through `public/data`. Private replay and diagnostic snapshots stay
gitignored.
