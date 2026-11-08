# Leerie scanner app

Flutter app carried on a night walk. It measures exposure-corrected light through the
camera (phyphox's method, `lib/detect/luminance.dart`), tags it with GPS about once a
second, and writes it to Supabase with the anon key, which can only insert.
Android and iOS run the same code.

## Run it

From this directory, with a phone on USB:

```sh
flutter run --release --dart-define-from-file=.env
```

`.env` (gitignored) holds `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `DEVICE_MODEL`
(for example `iphone-15`; calibration is per label, so each phone needs its own).
The URL and key can also be set in the app's Settings, which override the build values.

```sh
flutter test
flutter analyze
```

## What it writes

| When | Request |
|---|---|
| Every 20 s while recording | `POST /rest/v1/light_readings`, a batch of ~1 Hz readings with a random `session_id` per walk |
| Comfortable / Uncomfortable tap | `POST /rest/v1/incidents`, only while recording |

Geography is EWKT, longitude first: `SRID=4326;POINT(lng lat)`. Everything goes
through an upload queue (in order, retried with backoff); a crash loses the queue.

## Layout

```
lib/
  config.dart                  build-time Supabase values, batch and retry timings
  core/geo.dart                EWKT, haversine
  detect/luminance.dart        exposure-corrected relative luminance per frame
  data/                        row shapes, PostgREST client, upload queue
  session/                     settings (Supabase only) and the controller
  ui/                          the console, full-screen camera, settings sheet
```
