# Leerie — Hackathon Team Brief

Nov 8, 2026 · @Heechan

## Mission

Leerie turns any phone into a street-level light meter, maps how dark Edinburgh's streets really are at night, predicts the streets nobody walked, and turns that into two decisions: the safest walk home, and which streets a council should light first.

- **Build window:** 03:00 to 11:30 submission (deadline 12:00).
- **Team:** two developers with coding agents, plus the field team scanning while it is dark.
- **Study area:** the walk between George Square and King's Buildings, plus parallel streets.
- **Target tracks:** G-Research (Make the invisible visible) and HRT (Best Use of Data for Predictions & Decision Making). One product, two pitch endings.

## Where we stand at 03:00

Capture works and the database is done; the only missing capture piece is iOS, and that is mostly configuration because the app is Flutter.

**Working now**

- **Android scanner** (Flutter, Camera2 backend): linearised, exposure-corrected luminance per GPS fix, uploaded to `light_readings` every 20 s. Comfortable/Uncomfortable buttons write to `incidents` (commit c62fd2f, 02:17).
- **Supabase:** `light_readings`, `incidents`, `hotspots`, `street_scores`. 109 readings at 02:30; the app can only insert.
- **Dashboard:** Next.js 16 + MapLibre console, running on synthetic data.
- **Contract:** `data/segments.geojson`, as defined in `CLAUDE.md`.

**What the first 109 readings already tell us**

- Rows arrive every 4.6 s or so, not 1 Hz, most likely because Android's location stream is on its default interval. Each row averages about 5 m of walking, which is fine for street medians.
- ISO swings from 546 to 3,200 within two minutes, so the exposure correction is doing real work. Keep it exactly as it is.
- GPS accuracy is 5–6 m, with a few rows at 23–24 m that the 15 m filter will drop.
- `device_model` is empty on every row: the app never sends it. The iPhone build must send it, or the two phones can only be told apart by session.

**What changes from the earlier brief**

1. The model is tested on a **pre-registered forecast**: we predict streets nobody has walked, freeze the predictions, then walk them. An unwalked street cannot test a model on its own, because there is nothing to compare against.
2. The two phones are **calibrated against each other** on a shared walk.
3. **Lamp positions are free:** the council's street lighting dataset was imported into OpenStreetMap in June 2026, so OSMnx can fetch it. This unlocks "lamped but dark" flags.
4. The planner adds **Scan next** (where one more walk would most change the spending plan) and **Inspect first** (lamped streets that measure dark).
5. Routing and the planner run **in the browser** from `segments.geojson`, so there is no Python service to host.

**Next 15 minutes**

- [ ] Message the field team: keep scanning until 04:15, walk three or four streets twice in opposite directions, then come back for the iPhone handover.
- [ ] Export this brief to the repo as `docs/brief-v2.md` and point the "Start here" line in `CLAUDE.md` at it, so every coding agent works from the same plan.
- [ ] Dev A starts the iOS port; Dev B pulls the readings with the service key and starts pipeline v0.
- [ ] Both agree the contract additions in the Data contract section (5 minutes).

## Track strategy

Enter G-Research and HRT with one product and two endings; skip everything else unless a third person is free after 07:00.

| Challenge | Verdict | What their judges must see |
| --- | --- | --- |
| G-Research: Make the invisible visible (Switch 2s) | Enter, lead track | Their slide asks three things: what data is hidden, how we find it, what we do with it. Answer in that order: light on the pavement at night; phones as calibrated light meters; routes, a spending plan and lamp-fault flags. |
| HRT: Best Use of Data for Predictions & Decision Making (PS5s) | Enter | Their slide stresses signals built from diverse inputs and models that drive automated decisions. Show a new alternative-data signal (camera exposure metadata) fused with lamps, OSM and SIMD; out-of-sample proof (pre-registered forecast, leave-street-out tests against baselines); decisions computed live (route, budget, Scan next). |
| Wordsmith: agentic browser-use workflow (AirPods Max) | Only if a third person is free after 07:00 | A lamp-fault agent: takes Inspect-first streets, opens the council's fault-report pages, fills in lamp refs and measured evidence, drafts a FOISA request for maintenance records, and stops for human sign-off. Never submit to the real council in a demo. |
| Bank of Scotland: Smart Cost of Living | Skip | Their judges want personal-finance help; a taxi-savings angle would be a stretch. |
| JetBrains, InstaLILY, Viridien | Skip | Developer tools, coding agents and geology; no honest fit. |
| MLH category prizes | Check Devpost | MLH sponsors the event. Take any MLH prize that costs under 15 minutes. |

- [ ] Before 09:00, ask an organiser how many challenges one project may enter, and when and where each sponsor judges.

## MVP: what must work

A judge in the Nucleus Building asks for a night walk to George Square, and Leerie answers with measured light, a tested prediction and a decision.

1. **Measure.** Two phones record exposure-corrected light with GPS. Only numbers leave the phone, never images.
2. **Turn readings into streets.** Readings are cleaned, matched to OSM street segments and put on one scale across both phones, in stops (one stop = twice the light; −3 stops = 8× darker than the median street).
3. **Predict the gaps.** Every unwalked segment gets a brightness estimate with an 80% interval, tested against simple baselines and a pre-registered forecast.
4. **Score.** Light, reports and area crime combine into a 0–100 score with a hover breakdown and weight sliders.
5. **Decide.** Fastest vs safer route with its time cost, and a council planner that turns a budget into streets to light, plus Scan next and Inspect first.

## Team ownership: two parallel workstreams

Dev A owns everything people touch (phone and screens); Dev B owns everything that computes (pipeline, model and decision logic). They meet only at the data contract.

| Owner | Responsibility | Coding-agent deliverable |
| --- | --- | --- |
| **Dev A: Sensor and map** | iOS port and test walk (03:00–04:45), field handover, then the dashboard: scan map, route view, planner, Scan next and Inspect first layers, night replay. Records the demo video. | An iOS build writing the same row shape as Android, plus `device_model`. Next.js screens that read only `segments.geojson` and `validation.json`, wired to Dev B's `route.ts` and `planner.ts`. |
| **Dev B: Signal and decisions** | Pipeline, device calibration, prediction, validation and scores; route and planner logic; freezes the forecast at 04:40. Writes the Devpost text and the judge Q&A sheet. | `pipeline/run.py` (pull, clean, match, aggregate, calibrate, predict, score, export), re-run every 5 minutes while scanning. `pipeline/validate.py` writing `data/validation.json`. `route.ts` and `planner.ts` as pure functions with unit tests. `data/forecast_frozen.csv`, committed before the forecast walk. |
| **Field team** (not developers) | Second scanning session from 04:45: calibration walk, forecast streets, repeat passes. Logs each session. Films 20 s of night scanning if a spare phone exists. | Readings in Supabase and `data/sessions.csv` (session, phone, times, route, wet or dry pavement, any report and why). |

**Stack**

- **Phone:** Flutter (`sensor/`), one codebase for Android and iOS.
- **Database:** Supabase Postgres + PostGIS (done).
- **Pipeline and model:** Python 3.11, pandas, geopandas, OSMnx, networkx, scikit-learn.
- **Dashboard:** Next.js 16 + MapLibre; routing and planner run in the browser.
- **Hosting:** Vercel for the dashboard, with the files in `data/` as the offline fallback.
- **Collaboration:** Dev A owns `sensor/` and the dashboard's app and components; Dev B owns `pipeline/`, `data/` and `dashboard/src/lib/leerie/`. Commit prefixes `[A]` and `[B]`; pull before every step.

## Data contract

Keep every key of the `segments.geojson` contract in `CLAUDE.md` and add the keys below; nothing else passes between Dev A and Dev B. Unknown values stay `null`, never 0.

| Key | Type | Meaning |
| --- | --- | --- |
| `u`, `v` | int | OSM node ids at each end, for routing in the browser |
| `length_m` | number | Segment length in metres |
| `brightness_stops` | number or null | log2 of brightness relative to the median measured segment, after device calibration. 0 = median, −3 = 8× darker |
| `brightness_lo`, `brightness_hi` | number or null | 80% interval in stops: measurement spread if measured, prediction interval if predicted |
| `expected_stops` | number or null | What the model expects from street type, lamps and neighbours (out-of-fold for measured segments) |
| `lamps_per_100m`, `nearest_lamp_m` | number or null | From OSM `highway=street_lamp` |
| `inspect` | boolean | Lamped like its neighbours but at least 2 stops darker than expected |
| `usage` | number 0–1 | Share of sampled trips (campuses, halls, stations) that use the segment |
| `score_lo` | number 0–100 | Score using `brightness_lo`, for cautious routing |
| `forecast` | boolean | In the pre-registered forecast set |

`L` becomes the percentile rank of `brightness_stops`, so it is computed after calibration.

**Companion files**

- `data/validation.json`: every number shown on stage or on Devpost, written by `validate.py`.
- `data/forecast_frozen.csv`: `segment_id, pred_stops, lo, hi`, committed before the forecast walk; the commit time is the proof.
- `data/sessions.csv`: the field team's log. Rows with an empty `device_model` are the Android phone.

* [ ] Dev B adds the new keys to `data/segments.fake.geojson` by 03:20, so Dev A's screens never wait for real data.

## iOS port checklist (Dev A, 03:00–04:45)

The iOS port is about six small edits plus signing, because Flutter's iOS camera plugin already reports exposure time, ISO and aperture ([plugin source](https://github.com/flutter/packages/tree/main/packages/camera/camera_avfoundation)). The traps are signing and the luma range.

**Before building**

- [ ] On the iPhone: Settings → Privacy & Security → Developer Mode on (it restarts). Check `pod --version` on the Mac; installing CocoaPods costs minutes.
- [ ] `cd sensor && flutter create . --platforms ios --org uk.leerie` (it leaves `lib/` and `pubspec.yaml` alone).
- [ ] `ios/Runner/Info.plist`: add `NSCameraUsageDescription` ("Leerie measures how bright the street is. No images leave the phone.") and `NSLocationWhenInUseUsageDescription`.

**Code changes**

- [ ] **Luma range.** iOS streams the Y plane in video range (16–235); Android uses full range. Without a second lookup table, the darkest streets read too bright. In `luminance.dart`:

```dart
double _toLinear(double c) =>
    c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
final _linearFull = Float64List.fromList(
    List<double>.generate(256, (v) => _toLinear(v / 255)));
final _linearVideo = Float64List.fromList(List<double>.generate(
    256, (v) => _toLinear(((v - 16) / 219).clamp(0.0, 1.0))));
// meanLinearLuma: use Platform.isIOS ? _linearVideo : _linearFull
```

- [ ] **Row padding.** iOS plane bytes are `bytesPerRow × height`. Log `bytesPerRow` and `width` once; if they differ, sample inside each row.
- [ ] **Lens.** Recent iPhones list the wide, ultra-wide and (on Pro models) telephoto lenses as separate cameras. Pick the back camera with `lensType == CameraLensType.wide`; if this plugin version lacks `lensType`, the first back camera listed is normally the wide one.
- [ ] **1 Hz GPS.** On iOS pass `AppleSettings(accuracy: LocationAccuracy.bestForNavigation, activityType: ActivityType.fitness, distanceFilter: 0, pauseLocationUpdatesAutomatically: false)`. The same edit can give Android `AndroidSettings(intervalDuration: Duration(seconds: 1), distanceFilter: 0)` for its next install.
- [ ] **Device model.** Read `String.fromEnvironment('DEVICE_MODEL')` and add `device_model` to `Breadcrumb.toJson`. No new package needed.

**Build and prove it**

- [ ] Xcode → Runner → Signing & Capabilities: your Personal Team and a unique bundle ID. If `pod install` asks for a higher iOS version, raise `platform :ios` in `ios/Podfile`.
- [ ] Build in release, since iOS debug builds will not launch from the home screen: `flutter run --release --dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=… --dart-define=DEVICE_MODEL=iphone-<model>`. On first launch, trust the developer under Settings → General → VPN & Device Management.
- [ ] Two-minute test walk outside the Nucleus. New rows must have `iso`, `exposure_s`, `aperture`, `brightness` and `device_model` filled, and decode to Edinburgh (longitude about −3.2, latitude about 55.9).
- [ ] Side-by-side check: hold both phones together for 30 s under a lamp, then 30 s in shadow. The iPhone-to-Android brightness ratio should be about the same in both places.

**Gate at 04:45:** no valid iPhone rows means the second session goes out with Android only, and Dev A moves to the dashboard.

## Scanning protocol v2 (field team)

The second session, 04:45 to 06:30, produces the three numbers that win HRT: phone agreement, repeatability and the forecast score.

**Session 1 (now until 04:15):** keep scanning new parallel streets, walk three or four of them twice in opposite directions, then come back to warm up and swap phones.

**Session 2, in this order**

1. **Calibration, 10 minutes.** Hold both phones together, cameras side by side at the same angle. Walk from a bright main road into a dark side street and back, so the two phones are compared across the whole range.
2. **Forecast streets, 50–60 minutes.** Walk the list Dev B freezes at 04:40: 15 to 25 segments nobody has walked yet, mixing main roads, side streets and paths. Both phones, together.
3. **Repeats, whatever time is left.** Re-walk four to six session-1 streets in the opposite direction. If you are tired, drop these first.

**Rules**

- **Stop at 06:30.** For George Square on 8 November, nautical dawn is 06:08, civil dawn 06:52 and sunrise 07:34; at 06:30 the sun is 9° below the horizon. The pipeline drops readings after 06:30, which also keeps daytime demo readings out.
- **Moonlight is negligible:** new moon is about two days away, so the phones measure streetlight.
- **Same handling as before:** chest height, back camera at the pavement a few metres ahead, normal pace, app open on screen.
- **Log every session** in `data/sessions.csv` or a message to Dev B: start and end time, phone, route, wet or dry pavement, and any report with its reason.
- **Never walk alone.** Share live location with the team and carry a power bank.

## Execution plan

Everything that needs darkness runs first; from 07:00 the work is screens, numbers and the pitch.

&#91;embedded content: night plan · 3 lanes, 5 gates\]

Dev B freezes the forecast at 04:40 so the field team can walk it from 04:45, and the 07:00 go/no-go needs real data on the map.

## Data and model specification

Every street gets a brightness in stops and an honest interval; every claim on stage comes from `validation.json`.

### Data sources

| Source | Gives | Used for |
| --- | --- | --- |
| Our scans (`light_readings`) | Exposure-corrected linear luminance with GPS, about one row per 5 m | The signal |
| In-app reports (`incidents`, `hotspots`) | Comfortable and uncomfortable taps | R signal. Tonight's taps are ours, so present it as a working feature, not data |
| OpenStreetMap via OSMnx | Walking network, street type, `lit` tag | Segments, routing graph, features |
| OSM `highway=street_lamp` ([council lamps, imported June 2026](https://wiki.openstreetmap.org/wiki/Scotland/Import/Edinburgh/Street_Lamps)) | Lamp position, `ref` (council asset ID), `height`, `start_date` | Lamp features, Inspect first |
| SIMD crime indicators (as in the earlier brief) | Crime rate per data zone | C signal |

Take lamps from OSM, not the council download: the importer found the council's GeoJSON offset by up to 50 m. The dataset covers pole-mounted council lamps only, so wall-mounted lamps on tenement streets are missing.

### Signal

1. **Clean.** Drop rows with GPS accuracy worse than 15 m, speed above 3 m/s, missing exposure, or a time after 06:30.
2. **Match.** Assign each row to the nearest segment within 15 m whose bearing agrees with the walking direction within 45°, so rows do not jump to cross streets at junctions.
3. **Aggregate in stops.** Median of log2 brightness per segment and pass, then the median over passes. A segment is measured with at least 3 rows.
4. **Calibrate phones.** Fit a phone offset on the calibration walk and shared segments, with Android as the reference, and apply it before anything else.

```latex
s = \log_2 \frac{b}{\operatorname{median}(b_{\text{measured}})}, \qquad \log_2 b_r = \alpha_{\text{segment}(r)} + \delta_{\text{phone}(r)} + \varepsilon_r, \quad \delta_{\text{Android}} = 0
```

### Prediction

- **Target:** `brightness_stops` of measured segments.
- **Features:** street type, OSM `lit`, lamps per 100 m, distance to the nearest lamp, lamp height and age, shops and amenities within 50 m, and the mean of measured neighbours within 150 m (computed inside each fold to avoid leakage).
- **Model:** scikit-learn `HistGradientBoostingRegressor` kept shallow (depth 3), because there will be about 100 measured segments. Ridge regression is the fallback.
- **Interval:** 80% from out-of-fold errors: prediction ± the 80th percentile of absolute out-of-fold error.

### Validation (written to `validation.json`)

| Test | How | Shown as |
| --- | --- | --- |
| Leave-street-out | Hide whole streets (grouped by name), predict them, compare with three baselines: area median, median by street type, neighbour mean | Error in stops per method, with a 95% bootstrap interval on the improvement, resampling streets |
| Pre-registered forecast | Predictions frozen at 04:40, streets walked from 05:00 | Error vs the baselines, and how many forecast streets fell inside their 80% interval |
| Repeatability | Streets walked twice | Median difference between passes, in stops |
| Phone agreement | Calibration walk | Offset in stops and correlation |
| Coverage | All sessions | Kilometres walked, segments measured, rows |

### Decisions

- **Score** stays `100 × (0.5L + 0.3(1 − R) + 0.2(1 − C))`, with weight sliders and a hover breakdown.
- **Routing** keeps the earlier cost, but predicted segments use `score_lo`: the safer route trusts only what we are sure of.
- **Planner:** a segment costs `ceil(length ÷ spacing) × cost per light`, both entered by the council. Benefit is score gain × usage × length; pick by benefit per pound until the budget runs out.
- **Usage:** the share of 500 random trips inside the study area, plus campus-to-campus trips, that use the segment.
- **Scan next:** for each predicted candidate, p is the chance it is below the dark threshold, read from its interval. The top five by the value below go to the scanners.
- **Inspect first:** measured segments with at least the area's median lamps per 100 m, yet 2 or more stops darker than expected. Each carries its lamp `ref` numbers.

```latex
\text{cost} = \text{length} \times \left(1 + 3\left(1 - \tfrac{\text{score}}{100}\right)^{2}\right), \qquad \text{value}_j = p_j\,(1 - p_j) \times \Delta\text{score}_j \times \text{usage}_j \times \text{length}_j
```

### Limitations

- **Relative units, not lux.** Stops are ratios. One reading from a real lux meter would anchor them to the lighting classes councils design to (BS 5489-1, BS EN 13201).
- **The camera sees pavement.** Wet surfaces and pale stone read brighter, so the session log records wet or dry.
- **Lamp data** covers pole-mounted council lamps, recorded around 2024.
- **SIMD crime** is area-level and several years old, and it can brand a whole neighbourhood unsafe. Keep its slider visible.
- **One night, one area, two phones.** The forecast is a first out-of-sample test, not proof.

## Definition of done

A live demo runs this chain on tonight's data, and every number shown is read from `validation.json`, never typed in.

**Phone frame → exposure-corrected reading → street segment → calibrated stops → prediction with interval → score → route and spending decision**

Done at 09:30 means:

- [ ] Scan map on real data: measured streets solid, predicted faded, hover shows L, R, C, passes and interval.
- [ ] Route from the Nucleus to George Square: fastest vs safer, with the minutes it adds.
- [ ] Planner: draw a box, enter budget, cost per light and spacing; get the streets, the spend and the change in route score, plus Scan next and Inspect first.
- [ ] Validation panel with the five tests from the specification.
- [ ] The phone on stage: its live meter drops when the lens is covered and jumps under a light.
- [ ] Deployed dashboard that also runs offline from the files in `data/`.
- [ ] Devpost text, 2-minute video, screenshots and repo link.

> Every council knows where its lamps are. Nobody measures the light that reaches the pavement. Leerie makes it visible, predicts the streets nobody walked, and turns it into a safer route and a spending plan.

## Demo and pitch

Two minutes, one script, two endings; the judges are sitting at the end of the route, since the Nucleus is at King's Buildings.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:15 | Night replay: the map filling in street by street, 02:00 to 06:30 | "In 1885 Robert Louis Stevenson wrote: *O Leerie, I'll go round at night and light the lamps with you!* Leerie was Edinburgh's lamplighter. Nobody walks the streets checking the light any more. Last night, we did." |
| 0:15–0:35 | The phone: cover the lens, then point it at a ceiling light; one report tap | "Any phone becomes a light meter. We undo auto-exposure using the camera's own shutter and ISO data. No image ever leaves the phone." |
| 0:35–0:55 | Measured streets solid, predicted faded; hover one street | "We measured these streets and predicted the rest, each with an honest interval." |
| 0:55–1:15 | Validation panel: the forecast result | "At 04:40 we froze predictions for streets nobody had walked, then walked them. Here is how far off we were, next to the simple guesses." |
| 1:15–1:35 | Route from this building to George Square | "The safer route adds a few minutes and trusts only streets we are sure of." |
| 1:35–2:00 | Planner, Scan next, Inspect first | The ending for the track being judged. |

**G-Research ending:** "Light on the pavement was invisible in every council dataset. Now it is a map anyone can add to, and it has already found lamped streets that measure dark."

**HRT ending:** "Given this budget, light these streets first; here is how much safer the average walk gets. And before you spend, scan these five: that is where one more walk changes the plan most."

**Judge Q&A**

| Question | Answer |
| --- | --- |
| Is this lux? | No: exposure-corrected relative luminance in stops, with the two phones calibrated against each other. One lux-meter reading would anchor it. |
| Doesn't auto-exposure ruin it? | We undo it on every frame: linearised pixels × aperture² ÷ (exposure time × ISO), the method phyphox uses. |
| Does more light make streets safer? | A randomised trial in New York found extra lighting cut night-time outdoor index crimes by at least 36% ([Chalfin et al., NBER](https://econpapers.repec.org/RePEc:nbr:nberwo:25798)). We measure light; we don't predict crime. |
| How do you know the model works? | Whole streets hidden and predicted against three baselines, plus a forecast frozen before the streets were walked. |
| Councils already have lamp maps. | We use them. A lamp on a map is not light on a pavement, and Leerie flags lamped streets that measure dark. |
| How is this different from WalkSafe? | Crime-map apps such as WalkSafe show recent police crime data ([EU-Startups](https://www.eu-startups.com/2022/02/london-based-app-walksafe-picks-up-e360k-to-help-people-get-home-safe/)). Leerie measures the street itself and tells the council what to fix. |
| Is the safer route a promise? | No. It ranks streets by measured light and reports, and every score shows its inputs. |
| Privacy? | No images leave the phone, no accounts, insert-only access, and only per-street summaries are shown. |
| Would it scale? | Each row is a handful of numbers. Quote kilometres per walker-hour from `validation.json`; anyone with a phone can add streets. |

- [ ] Dev A records the video 09:30–10:30, using night footage if the field team filmed any.
- [ ] Rehearse both endings twice, timed, before 11:00.

## Scope and risk management

**Core rule:** a working chain on real data beats a clever model. Anything that needs darkness (iOS, calibration, the forecast walk) happens first and is timeboxed, because the night ends at 06:30.

**Checkpoints**

- **04:45, iOS gate and forecast freeze.** Valid iPhone rows or Android only; the forecast list is committed.
- **07:00, go or no-go.** Real-data map, predictions and routes working means go; otherwise submit PoliScope (its Devpost text is in `docs/pitch.md`).
- **09:30, feature freeze.** Bugs only after this; the numbers in `validation.json` are final.
- **11:00** submission ready; **11:30** submitted.

**Final priority order**

1. Real measured streets on the map.
2. Prediction with leave-street-out validation.
3. Safer route.
4. Planner with Scan next and Inspect first.
5. Second phone and calibration.
6. Pre-registered forecast.
7. Night replay and polish.
8. Wordsmith agent, only with a third person.

Items 5 and 6 run early because they need the dark, but they are the first to be cut if they slip.

| Risk | Fallback |
| --- | --- |
| iOS signing or build still blocked at 04:45 | Session 2 goes out with Android only; demo the app on Android |
| The phones differ by more than a constant ratio | Keep iPhone rows out of the model and show the comparison as a finding |
| Fewer than about 40 measured segments | Predict from neighbour means with intervals, and say so |
| The model does not beat the baselines | Show the baselines and the honest result; quant judges respect that more than a fake win |
| Forecast list not frozen by 04:40 | Session 2 walks new streets and repeats; validation relies on leave-street-out |
| OSMnx or Overpass slow at the venue | Save the graph and lamps to `data/` on the first good pull and commit them |
| Supabase unreachable during judging | The dashboard reads the committed files in `data/` |
| Daytime demo readings reach the database | The 06:30 cut drops them |
| Nothing works at 07:00 | Submit PoliScope |

## Sources

- [HackTheBurgh XIII event listing](https://createwith.com/event/edinburgh-hacktheburgh-xiii-nov-2026): venue, sponsors including MLH, and timings.
- [Edinburgh street lamps OSM import](https://wiki.openstreetmap.org/wiki/Scotland/Import/Edinburgh/Street_Lamps): council lamp data in OSM, its tags, and the 50 m offset in the council download.
- [Flutter camera\_avfoundation source](https://github.com/flutter/packages/tree/main/packages/camera/camera_avfoundation): iOS exposure metadata and video-range YUV.
- [Chalfin et al., NBER w25798](https://econpapers.repec.org/RePEc:nbr:nberwo:25798): the New York street lighting trial.
- [EU-Startups on WalkSafe](https://www.eu-startups.com/2022/02/london-based-app-walksafe-picks-up-e360k-to-help-people-get-home-safe/): WalkSafe's use of police crime data.
- Dawn and sunrise times: computed for George Square with the astral Python library.
- Repo state: [heechan02/Leerie](https://github.com/heechan02/Leerie) at commit c62fd2f, and the Supabase screenshot taken at 02:30.
