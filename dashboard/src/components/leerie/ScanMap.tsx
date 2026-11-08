"use client";
// The scan map: every street segment from data/segments.geojson, coloured by score,
// measured streets solid and predicted ones faded. Hover a street for its breakdown.
// Plan mode: drag a box, enter budget and costs, and the planner picks the streets to light.
import Link from "next/link";
import type { RecordingSelection } from "@/lib/leerie/replay";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, NavigationControl, Source, ScaleControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle } from "@/lib/map/style";
import { NIGHT } from "@/lib/map/tokens";
import { plan as runPlan, type Box } from "@/lib/leerie/planner";
import { HoverCard } from "./HoverCard";
import { Legend } from "./Legend";
import { PlanPanel, type PlanInputs } from "./PlanPanel";
import { DEFAULT_WEIGHTS, score, type Weights } from "./score";
import type { SegmentProps as Props } from "./types";
import { WeightSliders } from "./WeightSliders";

if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

type Segments = GeoJSON.FeatureCollection<GeoJSON.LineString, Props> & { recording_selection?: RecordingSelection };

const CENTER: [number, number] = [-3.181, 55.934]; // between George Square and King's Buildings
const REFRESH_MS = 60_000; // the pipeline loop rewrites segments.geojson every minute while scanning

/** Real file first, the fake one until Dev B's pipeline writes it. */
async function loadSegments(): Promise<{ data: Segments; source: string }> {
  for (const file of ["segments.geojson", "segments.fake.geojson"]) {
    const res = await fetch(`/data/${file}`, { cache: "no-store" });
    if (res.ok) return { data: (await res.json()) as Segments, source: file };
  }
  throw new Error("No segments file in data/.");
}

type Hover = { street: Props; x: number; y: number; width: number; height: number };
type Mode = "map" | "plan";
// Streets to light are white-hot with an amber halo, so they stand out from the amber end of the score ramp.
const { picked: PICKED, scan: SCAN } = NIGHT;

/** One point per street that two or more walks reported, at its middle vertex: per-street, never raw taps. */
function confirmedHotspots(fs: Segments["features"]): GeoJSON.FeatureCollection<GeoJSON.Point, { count: number }> {
  return {
    type: "FeatureCollection",
    features: fs.filter((f) => (f.properties.reports_confirmed ?? 0) > 0).map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)] },
      properties: { count: (f.properties.reports_possible ?? 0) + (f.properties.reports_confirmed ?? 0) },
    })),
  };
}

const boxPolygon = ([w, s, e, n]: Box): GeoJSON.Feature<GeoJSON.Polygon> => ({
  type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
});

export function ScanMap() {
  const [loaded, setLoaded] = useState<{ data: Segments; source: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [hover, setHover] = useState<Hover | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mode, setMode] = useState<Mode>("map");
  const [box, setBox] = useState<Box | null>(null);
  const drawFrom = useRef<[number, number] | null>(null);
  const [inputs, setInputs] = useState<PlanInputs>({ budget: "", costPerLight: "", spacingM: "" });
  // One layer at a time: lamp dots over coloured streets is too busy to read.
  const [layer, setLayer] = useState<"light" | "lamps">("light");

  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    const load = () => loadSegments().then(
      (d) => { setLoaded(d); setUpdatedAt(new Date()); setError(null); },
      // A failed refresh keeps the last good map; only the first load shows the error.
      (e: Error) => setError(e.message),
    );
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const plan = useMemo(() => {
    const [budget, costPerLight, spacingM] = [inputs.budget, inputs.costPerLight, inputs.spacingM].map(Number);
    if (mode !== "plan" || !loaded || !box || !(budget > 0 && costPerLight > 0 && spacingM > 0)) return null;
    return runPlan(loaded.data.features, box, { budget, costPerLight, spacingM, weights });
  }, [mode, loaded, box, inputs, weights]);

  // Recompute every score with the current weights; MapLibre colours by `_score`.
  const data = useMemo<Segments | null>(() => {
    if (!loaded) return null;
    const picked = new Set(plan?.picks.map((p) => p.segment_id));
    const scan = new Set(plan?.scanNext.map((p) => p.segment_id));
    return {
      ...loaded.data,
      features: loaded.data.features.map((f) => ({
        ...f,
        properties: { ...f.properties, _score: score(f.properties, weights),
          _picked: picked.has(f.properties.segment_id), _scan: scan.has(f.properties.segment_id) },
      })),
    };
  }, [loaded, weights, plan]);

  const hotspots = useMemo(() => (loaded ? confirmedHotspots(loaded.data.features) : null), [loaded]);
  const style = useMemo(() => buildMapStyle({ ...NIGHT, action: NIGHT.lit, committed: NIGHT.lit }), []);
  const counts = useMemo(() => {
    const fs = loaded?.data.features ?? [];
    const measured = fs.filter((f) => f.properties.measured);
    return {
      measured: measured.length,
      predicted: fs.filter((f) => !f.properties.measured && f.properties.L != null).length,
      km: measured.reduce((s, f) => s + (f.properties.length_m ?? 0), 0) / 1000,
    };
  }, [loaded]);

  // Open on the streets that have data: measured ones, else anything with an estimate.
  const fitted = useRef(false);
  // Read before the map mounts: once it loads, the map writes its own #zoom/lat/lng into the URL.
  const openedWithView = useRef(typeof window !== "undefined" && /^#[\d.]+\//.test(window.location.hash));
  useEffect(() => {
    const map = mapRef.current;
    // A #zoom/lat/lng link (the map's `hash`) opens exactly there instead.
    if (!loaded || !mapReady || !map || fitted.current || openedWithView.current) return;
    const fs = loaded.data.features;
    const focus = fs.filter((f) => f.properties.measured);
    const pts = (focus.length ? focus : fs.filter((f) => f.properties.L != null)).flatMap((f) => f.geometry.coordinates);
    if (!pts.length) return;
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: fitPadding(), maxZoom: 17, duration: 0 });
    fitted.current = true;
  }, [loaded, mapReady]);

  // Plan mode: press, drag and release on the map to draw the area.
  const onDown = (e: MapLayerMouseEvent) => {
    if (mode !== "plan") return;
    drawFrom.current = [e.lngLat.lng, e.lngLat.lat];
    setBox(null);
  };
  const onDrag = (e: MapLayerMouseEvent) => {
    const from = drawFrom.current;
    if (!from) return;
    if (e.originalEvent.buttons === 0) { drawFrom.current = null; return; } // released outside the map
    const [x, y] = [e.lngLat.lng, e.lngLat.lat];
    setBox([Math.min(from[0], x), Math.min(from[1], y), Math.max(from[0], x), Math.max(from[1], y)]);
  };
  const onHover = (e: MapLayerMouseEvent) => {
    if (drawFrom.current) return onDrag(e);
    const f = e.features?.[0];
    const box = e.target.getContainer();
    setHover(f ? { street: f.properties as Props, x: e.point.x, y: e.point.y, width: box.clientWidth, height: box.clientHeight } : null);
  };
  const isFake = loaded?.source.includes("fake") ?? false;

  return (
    <main className="lr-app">
      <section className="lr-map" aria-label="Map of streets coloured by score">
        <Map
          ref={mapRef}
          onLoad={() => setMapReady(true)}
          hash
          initialViewState={{ longitude: CENTER[0], latitude: CENTER[1], zoom: 13.8 }}
          mapStyle={style}
          style={{ position: "absolute", inset: 0 }}
          dragRotate={false}
          dragPan={mode === "map"}
          interactiveLayerIds={layer === "light" ? ["segments-hit"] : []}
          onMouseDown={onDown}
          onMouseUp={() => { drawFrom.current = null; }}
          onMouseMove={onHover}
          onClick={onHover}
          onMouseLeave={() => setHover(null)}
          cursor={mode === "plan" ? "crosshair" : hover ? "pointer" : "grab"}
        >
          {data && (
            <Source id="segments" type="geojson" data={data}>
              <Layer
                id="segments-line"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round", visibility: layer === "light" ? "visible" : "none" }}
                paint={{
                  "line-color": ["case", ["==", ["get", "_score"], null], NIGHT.dim,
                    ["interpolate", ["linear"], ["get", "_score"], ...NIGHT.ramp.flat()]],
                  // Measured solid, predicted faded, no estimate barely there.
                  "line-opacity": ["case", ["get", "measured"], 1, ["==", ["get", "_score"], null], 0.25, 0.4],
                  "line-width": ["interpolate", ["linear"], ["zoom"], 13, ["case", ["get", "measured"], 2.5, 1], 17, ["case", ["get", "measured"], 8, 3]],
                }}
              />
              {/* Wide invisible line so thin streets are easy to hover. */}
              {/* Opacity 0.01, not 0: MapLibre skips fully transparent layers when querying. */}
              <Layer id="segments-hit" type="line" paint={{ "line-width": 12, "line-opacity": 0.01 }} />
              <Layer id="segments-scan" type="line" filter={["==", ["get", "_scan"], true]}
                paint={{ "line-color": SCAN, "line-width": 4, "line-dasharray": [1, 1.5] }} />
              <Layer id="segments-picked-glow" type="line" filter={["==", ["get", "_picked"], true]}
                layout={{ "line-cap": "round" }} paint={{ "line-color": NIGHT.lamp, "line-width": 16, "line-blur": 10, "line-opacity": 0.7 }} />
              <Layer id="segments-picked" type="line" filter={["==", ["get", "_picked"], true]}
                layout={{ "line-cap": "round" }} paint={{ "line-color": PICKED, "line-width": 4 }} />
            </Source>
          )}
          {/* Council lamp columns: MapLibre fetches the file itself, only drawn when zoomed in. */}
          <Source id="lamps" type="geojson" data="/data/lamps.geojson">
            <Layer id="lamps-glow" type="circle" minzoom={13} layout={{ visibility: layer === "lamps" ? "visible" : "none" }} paint={{
              "circle-color": NIGHT.lamp, "circle-blur": 1, "circle-opacity": 0.35,
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3, 18, 14],
            }} />
            <Layer id="lamps-dot" type="circle" minzoom={13} layout={{ visibility: layer === "lamps" ? "visible" : "none" }} paint={{
              "circle-color": NIGHT.lit, "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 1, 18, 3],
            }} />
          </Source>
          {hotspots && (
            <Source id="hotspots" type="geojson" data={hotspots} cluster clusterRadius={40}
              clusterProperties={{ count: ["+", ["get", "count"]] }}>
              <Layer id="hotspots-circle" type="circle" paint={{
                "circle-color": ["interpolate", ["linear"], ["get", "count"], 1, NIGHT.hotLow, 20, NIGHT.hotHigh],
                "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 11, 20, 22],
                "circle-stroke-color": NIGHT.ground, "circle-stroke-width": 2, "circle-opacity": 0.92,
              }} />
              <Layer id="hotspots-count" type="symbol" layout={{
                "text-field": ["to-string", ["get", "count"]], "text-font": ["Noto Sans Bold"], "text-size": 13,
                "text-allow-overlap": true,
              }} paint={{ "text-color": "#ffffff" }} />
            </Source>
          )}
          {mode === "plan" && box && (
            <Source id="plan-box" type="geojson" data={boxPolygon(box)}>
              <Layer id="plan-box-fill" type="fill" paint={{ "fill-color": NIGHT.lamp, "fill-opacity": 0.06 }} />
              <Layer id="plan-box-line" type="line" paint={{ "line-color": NIGHT.lit, "line-width": 1.5, "line-dasharray": [2, 2] }} />
            </Source>
          )}
          <NavigationControl position="top-left" showZoom={false} visualizePitch={false} />
          <ScaleControl position="bottom-right" maxWidth={80} unit="metric" />
        </Map>
        <Legend mode={mode} layer={layer} />
        {hover && <HoverCard {...hover} weights={weights} />}
        {!loaded && (
          <div className="lr-card lr-glass lr-status" role={error ? "alert" : "status"}>
            {error ? (
              <>
                <strong>Could not load street data</strong>
                <p className="secondary" style={{ margin: "var(--s1) 0 0", fontSize: "var(--t-small)" }}>{error} Run the pipeline, then reload.</p>
              </>
            ) : (
              <span className="secondary">Loading street light data…</span>
            )}
          </div>
        )}
      </section>

      <header className="lr-topbar lr-glass">
        <Link href="/" className="lr-wordmark" aria-label="Leerie home"><span className="lr-lamp" aria-hidden /><span>Leerie</span></Link>
        <span className="lr-place">Edinburgh · George Square to King&apos;s Buildings</span>
        {updatedAt && (
          <span className="lr-live data"><i aria-hidden />updated {updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        )}
      </header>

      <aside className="lr-panel lr-glass" aria-label="Controls">
        <Link href="/replay" className="lr-button lr-button-ghost">Replay last night ↗</Link>
        {loaded?.data.recording_selection && <details className="lr-panel-intro"><summary>Data: 3 selected windows · 8 Nov · GMT</summary>{loaded.data.recording_selection.windows.map(([start, end]) => <div key={start} className="data">{start}–{end}</div>)}<p>Measurements and reports use only these windows. Predicted streets are recalculated from the selected measurements.</p></details>}
        <div className="lr-tabs" role="tablist" aria-label="View">
          {(["map", "plan"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className="lr-tab"
              onClick={() => { setMode(m); setHover(null); }}>
              {m === "map" ? "Streets" : "Plan lighting"}
            </button>
          ))}
        </div>

        <p className="lr-panel-intro">
          {mode === "map"
            ? "Each street is coloured by how much light reaches the pavement at night. Hover one to see why it scored that way."
            : "Draw a box over the area you are responsible for, then enter your budget."}
        </p>

        <section className="lr-stats" aria-label="Coverage" aria-busy={!loaded}>
          <StatCard value={String(counts.measured)} label="streets measured" loading={!loaded} />
          <StatCard value={String(counts.predicted)} label="streets predicted" loading={!loaded} />
          <StatCard value={counts.km.toFixed(1)} label="km walked" loading={!loaded} />
        </section>

        {mode === "plan" && (
          <PlanPanel plan={plan} hasBox={box != null} inputs={inputs} onInputs={setInputs} onClearBox={() => setBox(null)} />
        )}

        <section aria-labelledby="layers-h">
          <h2 id="layers-h" className="micro">Show</h2>
          <div className="lr-tabs" role="radiogroup" aria-labelledby="layers-h">
            {([["light", "Measured light"], ["lamps", "Council lamps"]] as const).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={layer === value} className="lr-tab"
                onClick={() => { setLayer(value); setHover(null); }}>
                {label}
              </button>
            ))}
          </div>
          <p className="lr-hint" style={{ marginTop: "var(--s2)", fontSize: "var(--t-micro)" }}>
            {layer === "light"
              ? "Our readings, street by street."
              : "City of Edinburgh Council lighting columns: where the lamps are, not how much light reaches the pavement."}
          </p>
        </section>

        <WeightSliders weights={weights} onChange={setWeights} />

        <footer style={{ display: "grid", gap: "var(--s2)" }}>
          {isFake && <p className="lr-warn" role="status">Placeholder data in use: these are not real readings.</p>}
          <p className="lr-source">
            <span className="data">data/{loaded?.source ?? "…"}</span> · relative light, not lux
          </p>
        </footer>
      </aside>
    </main>
  );
}

/** Keep the streets clear of the floating panel on wide screens. */
function fitPadding() {
  const wide = typeof window !== "undefined" && window.innerWidth > 860;
  return { top: 110, bottom: 90, left: 90, right: wide ? 470 : 40 };
}

function StatCard({ value, label, loading }: { value: string; label: string; loading: boolean }) {
  return (
    <div className="lr-stat">
      <div className={`data lr-stat-value${loading ? " lr-skeleton" : ""}`}>{loading ? "00" : value}</div>
      <div className="lr-stat-label">{label}</div>
    </div>
  );
}
