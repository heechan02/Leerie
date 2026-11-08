# Night-light safety map: team brief

Nov 8, 2026 · @Jan

## Summary

We measure how bright Edinburgh's streets actually are at night, by scanning them with iPhones, and turn that into a safety score per street. Walkers get a route that avoids dark or flagged streets. Councils get a planner that says which streets to light first for a given budget.

- **Deadline:** submissions close at 12:00. We submit by 11:30.
- **Study area:** the walk between the Central Area (George Square) and King's Buildings, plus parallel streets.
- **Fallback:** at 07:00 we decide go or no-go. If the scan map, routing and budget planner are not all working, we submit PoliScope, which is live and has its Devpost text ready.
- **Reuse:** the phone app, database and map dashboard come from Leerie (github.com/heechan02/Leerie), which already batches GPS and camera data to Supabase.

## Timeline

&#91;embedded content: tonight's plan · 5 lanes, 3 milestones\]

Scanning has to happen while it is dark, so it runs first; everything else is judged at the 07:00 go/no-go.

## Tracks and pitch

We enter G-Research and HRT with one product and two pitch endings. Wordsmith is not worth entering: its brief is about agents driving a web browser, and nothing here needs that.

| Track | First prize | What their judges must see |
| --- | --- | --- |
| G-Research: make the invisible visible | Nintendo Switch 2s | Councils know where lamps are, not how bright streets are. Our scan map shows real brightness, street by street, measured last night. |
| HRT: data for predictions and decisions | PlayStation 5s | A model that predicts brightness on unscanned streets, tested honestly against a simple baseline, and a budget planner that turns predictions into a spending decision. |

Hook: "Every council knows where its lamps are. None knows how dark its streets are. We walked between the campuses at 2am and measured it."

Check with organisers whether one project can enter two sponsor challenges.

## Data sources

Our own scans are the core dataset. Everything else is context we can download in minutes.

| Source | What it gives us | Used for | Limits |
| --- | --- | --- | --- |
| Our iPhone scans | Brightness estimate about once a second, with GPS | Light signal per street | Relative units, not true lux; only streets we walk |
| In-app reports | "I feel uncomfortable here" taps with GPS | Report signal per street | Tonight's reports come only from us, so present this as a working feature, not as data |
| [SIMD crime indicators](https://data.gov.scot/dataset/scottish_index_of_multiple_deprivation___crime_indicators) (Scottish Government, CSV) | Police Scotland counts and rates of selected crimes per data zone, 2014 to 2018 | Background crime level | Small areas, not streets; no time of day; several years old |
| OpenStreetMap, via OSMnx | Walking network, street types, the `lit` tag where mapped | Street segments, routing graph, model features | `lit` is often missing |
| Edinburgh street lamp locations | Lamp positions, if the council publishes them | Model feature: distance to nearest lamp | Not yet checked; skip if not found within 15 minutes |

Street-level crime from [data.police.uk](https://data.police.uk/docs/method/crime-street/) does not cover Police Scotland, so we do not use it.

## Architecture

&#91;embedded content: system architecture · 8 parts, 3 reused from Leerie\]

Everything downstream reads one table of street scores, so routing and the planner can be built against a fake version of it before the scans arrive.

## Phone app (iOS, Flutter, from Leerie)

Start from Leerie's `sensor/` app: it already streams the back camera, logs GPS about once a second, and uploads in retried batches.

**Keep**

- Camera stream and GPS logging in `session_controller.dart`.
- The upload queue in `upload_queue.dart`. Set `breadcrumbBatchSeconds` in `config.dart` to 20.
- The wakelock, so the screen stays on.

**Remove**

- The accelerometer and vision hazard detectors.

**Add**

1. A brightness value per frame in `_handleFrame`, attached to each GPS point. Flutter's `CameraImage` carries exposure time, ISO and aperture, so no native Swift code is needed:

```dart
double? relativeBrightness(CameraImage img) {
  final t = img.sensorExposureTime, iso = img.sensorSensitivity, n = img.lensAperture;
  if (t == null || iso == null || n == null) return null;
  final y = img.planes[0].bytes;                       // brightness channel
  var sum = 0, count = 0;
  for (var i = 0; i < y.length; i += 97) { sum += y[i]; count++; }
  return (sum / count) * n * n / ((t / 1e9) * iso);    // undoes auto-exposure
}
```

2. A large "Report" button that sends GPS, accuracy and a category (dark, followed, harassment, other). No photo, no name.
3. A random session ID per walk, not per person.

**iOS rules**

- The camera cannot run in the background, so walkers keep the app open on screen.
- Lock the app to the main wide camera; iPhone Pros otherwise switch lenses.
- Add camera and location permission messages to `Info.plist`.
- Building needs a Mac with Xcode. Whoever did Leerie's iOS build owns this.
- Before the main scan, do a 30-second test walk and confirm the exposure values are not empty in Supabase.

## Database (Supabase)

Two tables, adapted from Leerie: `scanner_positions` becomes `light_readings`, and `detections` becomes `incidents`. Turn on the PostGIS extension first.

```sql
create table light_readings (
  id bigint generated always as identity primary key,
  session_id uuid not null,          -- random per walk, not per person
  recorded_at timestamptz not null,
  location geography(point) not null,
  gps_accuracy_m real,
  speed_mps real,
  brightness real,                   -- relativeBrightness() output
  iso real, exposure_s real, aperture real,
  device_model text
);

create table incidents (
  id bigint generated always as identity primary key,
  session_id uuid,
  created_at timestamptz default now(),
  location geography(point) not null,
  gps_accuracy_m real,
  category text                      -- 'dark', 'followed', 'harassment', 'other'
);

alter table light_readings enable row level security;
alter table incidents enable row level security;
create policy "app can insert" on light_readings for insert to anon with check (true);
create policy "app can insert" on incidents for insert to anon with check (true);
```

- **Hotspots:** reuse Leerie's clustering trigger (`match_or_create_hazard`). One report marks a possible hotspot; a second report from a different session within about 25 m confirms it. This stops one person or one prank from marking a street unsafe.
- **Privacy:** the app can add rows but not read them back. Dashboards read only per-street summaries, never raw report points. Leerie's access rules were wide open; do not copy them.

## Safety score

Each street segment gets a score from 0 (worst) to 100 (best), built from three signals that are each turned into 0 to 1. Every score shows its breakdown on hover.

| Signal | Source | Turned into 0 to 1 by |
| --- | --- | --- |
| Light, L | Scans, or the model's prediction for unscanned streets | Ranking the segment's median brightness against every segment in the area |
| Reports, R | Confirmed and possible hotspots | Reports per pass, with a starting assumption so one report on a quiet street is not 100% bad: R = (reports + 1) / (passes + 10) |
| Area crime, C | SIMD crime rate for the segment's data zone | Ranking across Edinburgh's data zones |

```latex
\text{Score} = 100 \times \left(0.5\,L + 0.3\,(1 - R) + 0.2\,(1 - C)\right)
```

- **The weights are our choice, not something the data proves.** Say so on stage and let the council adjust them with sliders.
- **Show confidence.** Predicted streets are faded on the map; streets walked many times are solid.
- **Passes** come from scan sessions: each session that crosses a segment counts once.

## Processing and prediction

A Python script turns raw readings into a brightness value for every street, including streets nobody walked. This is the HRT model.

1. **Clean.** Drop readings with GPS accuracy worse than 15 m or speed above 3 m/s.
2. **Match to streets.** Pull the walking network around the study area with OSMnx. Assign each reading to the nearest segment within 15 m.
3. **Summarise.** Median brightness per segment, kept only where a segment has at least 3 readings.
4. **Predict unscanned streets** with a small gradient-boosted model. Features per segment:
   - mean brightness of neighbouring scanned segments;
   - OSM `lit` tag;
   - street type (main road, side street, footpath, park path);
   - distance to the nearest lamp, if lamp data is found.
5. **Test honestly.** Hide whole scanned streets, predict them, and compare the error with guessing the area median. Report the error reduction with a confidence interval, as PoliScope did.

Output: one table of segments with brightness, whether it was measured or predicted, report counts, SIMD rate, and the score. Routing and the budget planner both read this table.

## Routing

A small Python service on the OSMnx graph finds the safest route with networkx, because OSRM and Google Maps cannot steer around streets we choose.

```latex
\text{cost} = \text{length} \times \left(1 + 3\left(1 - \frac{\text{score}}{100}\right)^{2}\right)
```

- Streets below the walker's chosen threshold are removed whenever another route exists.
- The app shows the fastest and the safest route side by side, with the trade-off: "the safer route adds 3 minutes".
- Draw both with Leerie's `RouteLayer`.

## Council budget planner

The council drags a box over the map, enters a budget and a cost per light, and gets the list of streets to light that raises safety the most. This is the HRT decision moment.

1. **Candidates:** dark segments inside the selected area.
2. **Effect of a light:** the segment's L rises to the level of a typical well-lit street; its score is recomputed.
3. **Benefit:** score gain × how much the street is used. Use the number of likely routes passing through it (between campuses, halls and stations) as a stand-in for foot traffic.
4. **Choice:** pick the best benefit per pound first until the budget runs out.
5. **Show:** streets to light highlighted on the map, total spend, and how much the average route score rises.

Reuse Leerie's dispatch panel layout for this screen. The cost per light is a number the council enters; we do not claim one.

## Scanning protocol for tonight

Two people walk the study area together while it is dark. Consistency matters more than distance.

- [ ] Confirm the test walk's readings reached Supabase with exposure values filled in.
- [ ] Same iPhone model for both scanners if possible; note the model if not.
- [ ] Hold the phone at chest height, back camera pointing at the pavement a few metres ahead.
- [ ] Walk at normal pace; do not run or cycle.
- [ ] Cover several parallel streets, not one route, so the model has neighbours to learn from.
- [ ] Walk some streets twice, in opposite directions, so we can measure how repeatable a scan is.
- [ ] Leave some streets unwalked on purpose: they are the honest test for the prediction model.
- [ ] Tap Report only for a real reason, and note what it was.

Stay together, keep phones charged, and come back by 03:30 whatever the coverage.

## Demo script (2 minutes)

| Time | Show | Say |
| --- | --- | --- |
| 0:00 to 0:15 | The scan map, dark streets glowing dim | "Every council knows where its lamps are. None knows how dark its streets are. We walked between the campuses at 2am and measured it." |
| 0:15 to 0:40 | The phone app scanning, then a Report tap | "Any iPhone becomes a light meter. One tap flags a street that feels unsafe; a second, independent report confirms it." |
| 0:40 to 1:05 | Faded predicted streets, then the test result | "We predict streets nobody walked, and we tested that honestly on streets we hid from the model." |
| 1:05 to 1:30 | Fastest vs safest route from George Square to King's Buildings | "The safer route adds a few minutes and avoids every street below your threshold." |
| 1:30 to 2:00 | Budget planner: drag a box, enter a budget | Ending for the track being judged (below). |

**G-Research ending:** "Brightness was invisible in every council dataset. Now it is a map anyone can add to."

**HRT ending:** "Given this budget, light these streets first. Here is how much safer the average walk gets, and how sure we are."

## Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Exposure values come back empty on iOS | Use mean frame brightness with exposure locked in the app; results are less reliable on very dark streets |
| The iOS build fails or signing blocks it | Record GPS with any tracking app and film with exposure locked; join the two by timestamp afterwards |
| Too few streets scanned to train a model | Present measured streets only, plus a neighbour average for gaps, and say so |
| Routing service not ready by 07:00 | Show precomputed routes for two fixed trips |
| Nothing working by 07:00 | Submit PoliScope; its Devpost text and video script are in `docs/pitch.md` |
| Judges ask whether a "safe" route is a promise | It is not: the score ranks streets by measured light and reports, and every score shows its inputs |
| Judges ask about the privacy of reports | No accounts, insert-only access, and only per-street summaries are shown |

## Workstreams to delegate

Four workstreams, one person each. Fill in the owner column together before anyone starts.

| Workstream | Owns | Done by | Needs | Owner |
| --- | --- | --- | --- | --- |
| 1. Phone app | Leerie sensor app changes, iOS build, test walk | 01:45 test walk passes | Mac with Xcode, an iPhone |  |
| 2. Scanning and database | Supabase tables, access rules, hotspot trigger; then scanning with one other person | 03:30 back with data | Supabase project, charged phones |  |
| 3. Processing and model | Cleaning, street matching, prediction, honest test, scores; routing service | 07:00 scores and routes work | Python, OSMnx, SIMD CSV |  |
| 4. Dashboard and pitch | Leerie map adapted to the scan map, routes, budget planner; video and Devpost | 07:00 screens work on real data; 11:00 submission ready | Next.js, MapLibre |  |

Workstream 1 helps with scanning once the app works. Whoever finishes first after 07:00 joins workstream 4 on the video.
