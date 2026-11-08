# CLAUDE.md: Leerie

## Start here
- The plan is `docs/brief-v2.md`. Read all of it first. If this file and the brief disagree, the brief wins.
- Your human will say whether they are **Dev A** (sensor and map: `sensor/`, dashboard app and components)
  or **Dev B** (signal and decisions: `pipeline/`, `data/`, `dashboard/src/lib/leerie/`).
  Work only inside your own folders unless asked. The two meet only at the data contract.
- Deadline: we submit at 11:30 (submissions close at 12:00). Gates: 04:45 iOS gate and forecast freeze,
  07:00 go/no-go (no-go = submit PoliScope, `../poliscope/docs/pitch.md`), 09:30 feature freeze.
- Run `date` at every step. From 09:30, fix bugs only.

## Layout
| Folder | Owner | What |
| --- | --- | --- |
| `sensor/` | A | Flutter scanner, Android and iOS |
| `supabase/` | done | Tables, insert-only RLS |
| `pipeline/` | B | `run.py` (pull → export), `validate.py` |
| `data/` | B | `segments.geojson`, `validation.json`, `forecast_frozen.csv`, `sessions.csv` |
| `dashboard/` | A (app, components), B (`src/lib/leerie/`: `route.ts`, `planner.ts`) | Next.js 16 + MapLibre, reads only `data/` files |

## Android scanner MVP (working now)
- `sensor/` records exposure-corrected camera luminance (phyphox's method, `lib/detect/luminance.dart`)
  averaged per GPS point (~1 Hz), and uploads to `light_readings` every 20 s with a random `session_id` per walk.
- It uses the Camera2 backend (`camera_android`), because the default CameraX one gives no exposure, ISO or aperture.
- The footer shows the live light value; "no exposure data from camera" means that phone can't be used.
- Database: run `supabase/migrations/20261108000000_light_readings.sql` in the Supabase SQL editor.
  It is insert-only for anon; read the data with the service key.
- Build and install on a USB-connected phone, from `sensor/`:
  `flutter run --release --dart-define=SUPABASE_URL=https://<ref>.supabase.co --dart-define=SUPABASE_ANON_KEY=<anon>`
  (or set the URL and key in the app's Settings → Supabase).
- Comfortable/Uncomfortable buttons write to `incidents`, only while recording (so every report has a `session_id`).
- iOS works (same Flutter code): video-range luma on iOS, main wide lens, 1 Hz GPS, `device_model` from a build define.
  Put `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `DEVICE_MODEL=iphone-<model>` in `sensor/.env` (gitignored), then
  `flutter run --release --dart-define-from-file=.env`. Give each phone its own `DEVICE_MODEL`: calibration is per label.

## Starting code
- `sensor/` has no `ios/` folder. Generate one with `flutter create . --platforms ios`, then add
  `NSCameraUsageDescription` and `NSLocationWhenInUseUsageDescription` to `ios/Runner/Info.plist`.
  On iOS, change the luminance lookup in `luminance.dart` to video range: `(v-16)/219`.
- `dashboard/` is Next.js 16 + MapLibre + zustand, and runs on synthetic data with no `.env.local`.
  Reuse `components/console/map/RouteLayer.tsx`, `DispatchSheet.tsx` (planner layout) and `lib/map/style.ts`.
  Clients read `*_map` views, because PostgREST returns geography as hex WKB.
- Drop: the accelerometer/vision detectors, `contractor/`, `/api/plan-route` (OSRM), `/api/dispatch` (Resend) and the crew pages.

## The one shared contract
Everything downstream reads `data/segments.geojson`, one feature per OSM street segment.
Dev B writes it. Until the real one exists, both build against `data/segments.fake.geojson`.
The keys below plus the additions in the brief's "Data contract" section (`u`, `v`, `length_m`,
`brightness_stops`, `brightness_lo/hi`, `expected_stops`, lamp keys, `inspect`, `usage`, `score_lo`, `forecast`).
Properties (snake_case; unknown values are `null`, never 0):

| Key | Type | Meaning |
| --- | --- | --- |
| `segment_id` | string | OSM `u-v-key` |
| `name` | string or null | street name |
| `highway` | string | OSM street type |
| `osm_lit` | string or null | OSM `lit` tag |
| `brightness` | number or null | median relative brightness (not lux) |
| `measured` | boolean | true if scanned (≥3 readings), false if predicted |
| `n_readings`, `passes` | int | readings and distinct sessions on the segment |
| `reports_possible`, `reports_confirmed` | int | hotspot counts, never raw points |
| `simd_crime_rate` | number or null | SIMD crime rate of the data zone |
| `L`, `R`, `C` | number 0-1 | score signals, as defined in the brief |
| `score` | number 0-100 | `100 × (0.5L + 0.3(1−R) + 0.2(1−C))` |

Change this contract only with the whole team's agreement.

## Rules
- Privacy: the app can only insert. Dashboards read per-street summaries only, never raw report points or session IDs. Don't copy Leerie's open access rules.
- Brightness is relative, not lux. Say so wherever it's shown.
- The score weights are our choice; show them as adjustable sliders, and show each score's breakdown on hover.
- Predicted streets are drawn faded; measured streets are drawn solid.
- Neutral wording: a "safer" route ranks streets by light and reports. It isn't a promise.
- Secrets (Supabase keys) go in `.env` files, which stay out of git.

## Code style
- Python 3.11, pandas, osmnx, networkx, scikit-learn; `ruff format`.
- Flutter/Dart as Leerie has it. Next.js App Router, TypeScript strict, MapLibre.
- Commit messages: `[A]` or `[B]` + what changed. Pull before every step, then push to main.
