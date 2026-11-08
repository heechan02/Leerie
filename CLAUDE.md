# CLAUDE.md: Night-light safety map (Leerie)

## Start here
- The plan is `Night-light safety map team brief.md`. Read all of it first. If this file and the brief disagree, the brief wins.
- Your human will say which workstream they own (1-4):
  1 = Phone app, 2 = Scanning and database, 3 = Processing, model and routing, 4 = Dashboard and pitch.
  Work only inside that workstream's folder (below) unless asked.
- Deadline: we submit at 11:30 (submissions close at 12:00). At 07:00 the team decides go or no-go.
  If it's no-go, we submit PoliScope (`../poliscope`, pitch in `../poliscope/docs/pitch.md`).
- Run `date` at every step. From 09:30, fix bugs only.

## Layout
| Folder | Workstream | Origin |
| --- | --- | --- |
| `app/` | 1. Flutter iOS app | Leerie `sensor/` (github.com/heechan02/Leerie) |
| `db/` | 2. Supabase SQL: tables, RLS, hotspot trigger | Leerie schema, adapted |
| `pipeline/` | 3. Python: clean, match, predict, score, routing service | new |
| `dashboard/` | 4. Next.js + MapLibre: scan map, routes, budget planner | Leerie dashboard |
| `data/` | Shared files between workstreams (see contract) | |

## The one shared contract
Everything downstream reads `data/segments.geojson`, one feature per OSM street segment.
Workstream 3 writes it. Until the real one exists, workstreams 3 and 4 build against a fake one at `data/segments.fake.geojson`.
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
- Commit messages: `[<workstream number>] what changed`. Pull before every step, then push to main.
