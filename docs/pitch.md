# Leerie: pitch, demo and submission

Numbers below are from the final pipeline run (data frozen 07:20, 8 Nov). The landing page and map read them live from `data/`, so if they ever disagree, the page is right.

| | |
| --- | --- |
| Light readings matched to streets | 5,833 |
| Streets measured / predicted | 176 / 1,293 |
| Walked | 30.2 km |
| Council lamp posts joined | 5,504 |
| Lamped but dark (Inspect first) | Buccleuch Place (2.7 stops darker), Findhorn Place (2.3), Chalmers Crescent (2.3) |

## Two-minute demo

Have three things open: the landing page at the top, `/map` in a second tab, and the phone app recording.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:15 | Landing hero, start scrolling slowly | "In 1885 Robert Louis Stevenson wrote: *O Leerie, I'll go round at night and light the lamps with you.* Leerie was Edinburgh's lamplighter. Nobody walks the streets checking the light any more. Last night, we did." |
| 0:15–0:30 | Scroll to the four stats | "One in two women in Britain feels unsafe on a quiet street near home after dark. In Scotland it's over a third. Light is one thing a council can change: in a New York trial, more lighting cut night-time outdoor crime by at least 36 percent. But nobody measures the light that actually reaches the pavement." |
| 0:30–0:50 | The phone: cover the lens, then point it at a ceiling light | "Any phone becomes a light meter. We undo auto-exposure with the camera's own shutter speed and ISO, and keep one number a second. No image ever leaves the phone." |
| 0:50–1:15 | `/map`: measured streets solid, predicted faded; hover Relugas Road | "We walked 30 kilometres overnight: 176 streets measured, 1,293 more predicted from their neighbours, each with an honest range. Every score shows its working, and the weights are sliders, because they're a choice." |
| 1:15–1:35 | Back to the landing page, "Lamped, but dark" (or the Inspect first list) | "Then we joined 5,504 council lamp posts. Findhorn Place has as many lamps as a typical street, yet measures 2.3 stops darker than the streets around it. That's about a fifth of the light. Here are the lamp IDs to send an inspector to." |
| 1:35–2:00 | `/map` → Plan lighting: drag a box, £60,000, £2,000 per light, 30 m | The ending for the track being judged (below). |

**G-Research ending:** "Light on the pavement was invisible in every council dataset. Now it's a map anyone can add to, and it has already found lamped streets that measure dark."

**HRT ending:** "Given this budget, light these streets first: here's the works order for contractors, and how much the area's score rises. And before you spend, walk these five: that's where one more walk changes the plan most."

**Overall:** end on the G-Research line, then "Leerie. One phone, one walk, and a council knows where to start."

## Judge Q&A

| Question | Answer |
| --- | --- |
| Is this lux? | No. It's exposure-corrected relative brightness in stops: +1 is twice the light of the median street. One lux-meter reading would anchor it to the BS 5489 lighting classes. |
| Doesn't auto-exposure ruin it? | We undo it on every frame: linearised pixels × aperture² ÷ (exposure time × ISO), the method the phyphox lab app uses. Cover the lens and the number drops; point it at a lamp and it jumps. |
| Different phones? | Each reading carries its device model, so phones can be calibrated against each other. We haven't applied a per-phone correction yet; that's the first thing we'd add. |
| How do you predict unwalked streets? | From the measured streets within 150 m, with a range that widens with their spread. Predicted streets are drawn faded and never treated as measured. |
| Does more light make streets safer? | A randomised trial in New York found extra lighting cut night-time outdoor index crimes by at least 36% (Chalfin et al., NBER). We measure light; we don't predict crime. |
| Councils already have lamp maps. | We use them: 5,504 council columns. A lamp on a map is not light on a pavement, and Leerie flags the lamped streets that measure dark. |
| How is this different from crime-map apps? | They show past police data. Leerie measures the street itself and tells the council what to fix. |
| Privacy? | No images leave the phone, no accounts, a random ID per walk, an insert-only app key, and the map shows only per-street summaries. |
| What about pranks? | A report only counts as confirmed once two different walks report the same spot. |
| Would it scale? | Each reading is a handful of numbers. A few walkers covered 30 km in one night; anyone with a phone can add streets. |
| What's the planner doing? | A greedy pick by score gained per pound, with the council's own cost per light and spacing. Scan next ranks predicted streets by how likely they are dark × how much lighting them would gain. |

## Submission form (copy and paste)

**Project title:** Leerie

**Tagline** (132 characters):
> Any phone becomes a street light meter. Leerie maps how dark Edinburgh's streets really are and tells the council what to fix first.

**Tracks:** Best project overall (Metaview), Best Use of Data for Predictions & Decision Making (HRT), Make the Invisible Visible (G-Research).

**Repository:** https://github.com/heechan02/Leerie

**Screenshots** (in `docs/screenshots/`, in this order; the first is the cover):
1. `1-landing.png`
2. `8-lamps-vs-light.png`
3. `3-map-hover.png`
4. `4-plan.png`
5. `5-lamped-but-dark.png`
6. `2-why.png`
7. `7-mapped.png`
8. a phone screenshot of the app while recording (take it on the phone)

**Project description:**

> **The problem.** One in two women in Britain feels unsafe walking alone after dark on a quiet street near home (ONS, 2021). In Scotland, 35% of women don't feel safe walking alone in their own area after dark, against 10% of men (Scottish Crime and Justice Survey 2019/20). Light is one of the few things a council can change, and a randomised trial in New York found extra lighting cut night-time outdoor crime by at least 36%. But councils only know where their lamps are, not how much light reaches the pavement.
>
> **What Leerie does.** It turns any phone into a street light meter. You walk with the camera facing ahead; Leerie undoes auto-exposure using the camera's own shutter speed, ISO and aperture (the phyphox method), and uploads one brightness reading a second with its GPS point. Comfortable and Uncomfortable buttons record how a street feels. A pipeline matches readings to OpenStreetMap streets, predicts unwalked streets from their measured neighbours with an honest range, and joins the City of Edinburgh Council's lighting columns. The map shows every street's score with its breakdown, and a planner turns a budget into the streets to light first, a works order for contractors, where to walk next, and lamped streets that measure dark.
>
> **Last night.** We walked 30 km between George Square and King's Buildings: 5,833 readings, 176 streets measured, 1,293 predicted and 5,504 council lamp posts joined. Three streets have as many lamps as a typical street yet measure over two stops darker than their neighbours: Buccleuch Place, Findhorn Place and Chalmers Crescent.
>
> **How we built it.** Flutter app for Android and iOS (Camera2 on Android for exposure metadata, video-range luma on iOS); Supabase Postgres + PostGIS with insert-only row-level security and a hotspot trigger that only confirms a report once two different walks agree; a Python pipeline; a Next.js + MapLibre dashboard that reads static files, so it runs offline.
>
> **Privacy.** No images leave the phone, no accounts, a random ID per walk, an app that can write but never read, and only per-street summaries on the map.
>
> **Limits.** Brightness is relative, not lux. Predictions are a neighbour average, not yet a trained model. Area crime (SIMD) is not in the score yet. A brighter street is not a promise of safety.
>
> **Disclosure.** The landing page image was generated with Higgsfield.
