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
quality and walking speed, samples at ten-second intervals, and splits trails at
gaps or implausible jumps. The recording currently uses Edinburgh's November GMT.
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
recomputed from the selected readings. Existing GPS/speed quality rules remain
for the street map and filtered replay. The all-GPS replay keeps every point
inside the windows, with each window represented as a separate trail.

After changing the windows, run `python3 -m pipeline.run`,
`python3 -m pipeline.replay 2026-11-08`, `python3 -m pipeline.replay --raw`, then
`node dashboard/scripts/copy-maplibre-worker.mjs`. The live pipeline loop also
uses this selection on every refresh. Replay snapshots remain local and private.
