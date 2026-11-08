"use client";
// The scan map: every street segment from data/segments.geojson, coloured by score,
// measured streets solid and predicted ones faded. Hover a street for its breakdown.
// Plan mode: drag a box, enter budget and costs, and the planner picks the streets to light.
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

type Segments = GeoJSON.FeatureCollection<GeoJSON.LineString, Props>;

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
const PICKED = "#7fd4ff"; // streets to light: not on the score ramp, so they stand out from it
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
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !mapReady || !map || fitted.current) return;
    const fs = loaded.data.features;
    const focus = fs.filter((f) => f.properties.measured);
    const pts = (focus.length ? focus : fs.filter((f) => f.properties.L != null)).flatMap((f) => f.geometry.coordinates);
    if (!pts.length) return;
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 17, duration: 0 });
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
    <main className="night">
      <section className="lr-map" aria-label="Map of streets coloured by score">
        <Map
          ref={mapRef}
          onLoad={() => setMapReady(true)}
          initialViewState={{ longitude: CENTER[0], latitude: CENTER[1], zoom: 14.3 }}
          mapStyle={style}
          style={{ position: "absolute", inset: 0 }}
          dragRotate={false}
          dragPan={mode === "map"}
          interactiveLayerIds={["segments-hit"]}
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
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{
                  "line-color": ["case", ["==", ["get", "_score"], null], NIGHT.dim,
                    ["interpolate", ["linear"], ["get", "_score"], 0, NIGHT.dim, 50, NIGHT.mid, 100, NIGHT.lit]],
                  // Measured solid, predicted faded, no estimate barely there.
                  "line-opacity": ["case", ["get", "measured"], 1, ["==", ["get", "_score"], null], 0.25, 0.4],
                  "line-width": ["interpolate", ["linear"], ["zoom"], 13, ["case", ["get", "measured"], 2.5, 1], 17, ["case", ["get", "measured"], 8, 3]],
                }}
              />
              {/* Wide invisible line so thin streets are easy to hover. */}
              {/* Opacity 0.01, not 0: MapLibre skips fully transparent layers when querying. */}
              <Layer id="segments-hit" type="line" paint={{ "line-width": 12, "line-opacity": 0.01 }} />
              <Layer id="segments-scan" type="line" filter={["==", ["get", "_scan"], true]}
                paint={{ "line-color": PICKED, "line-width": 4, "line-dasharray": [1, 1.5] }} />
              <Layer id="segments-picked" type="line" filter={["==", ["get", "_picked"], true]}
                layout={{ "line-cap": "round" }} paint={{ "line-color": PICKED, "line-width": 6 }} />
            </Source>
          )}
          {mode === "plan" && box && (
            <Source id="plan-box" type="geojson" data={boxPolygon(box)}>
              <Layer id="plan-box-fill" type="fill" paint={{ "fill-color": PICKED, "fill-opacity": 0.06 }} />
              <Layer id="plan-box-line" type="line" paint={{ "line-color": PICKED, "line-width": 1.5, "line-dasharray": [2, 2] }} />
            </Source>
          )}
          <NavigationControl position="top-right" showZoom={false} visualizePitch={false} />
          <ScaleControl position="bottom-right" maxWidth={80} unit="metric" />
        </Map>
        <Legend />
        {hover && <HoverCard {...hover} weights={weights} />}
        {!loaded && (
          <div className="lr-card lr-status" role={error ? "alert" : "status"}>
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

      <aside className="lr-panel">
        <header>
          <div className="lr-brand">
            <span className="lr-lamp" aria-hidden />
            <h1 style={{ fontSize: "var(--t-title)", letterSpacing: "-0.01em" }}>Leerie</h1>
          </div>
          <p className="micro secondary" style={{ marginTop: "var(--s2)" }}>Edinburgh · George Square to King&apos;s Buildings</p>
        </header>

        <div className="lr-tabs" role="tablist" aria-label="View">
          {(["map", "plan"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className="lr-tab"
              onClick={() => { setMode(m); setHover(null); }}>
              {m === "map" ? "Streets" : "Plan lighting"}
            </button>
          ))}
        </div>

        <section className="lr-stats" aria-label="Coverage" aria-busy={!loaded}>
          <StatCard value={String(counts.measured)} label="streets measured" loading={!loaded} />
          <StatCard value={String(counts.predicted)} label="streets predicted" loading={!loaded} />
          <StatCard value={counts.km.toFixed(1)} label="km measured" loading={!loaded} />
        </section>

        {mode === "plan" && (
          <PlanPanel plan={plan} hasBox={box != null} inputs={inputs} onInputs={setInputs} onClearBox={() => setBox(null)} />
        )}

        <WeightSliders weights={weights} onChange={setWeights} />

        <footer style={{ display: "grid", gap: "var(--s2)" }}>
          {isFake && <p className="lr-warn" role="status" style={{ margin: 0 }}>Placeholder data in use: these are not real readings.</p>}
          <p className="lr-source" style={{ margin: 0 }}>
            <span className="data">data/{loaded?.source ?? "…"}</span> · relative light, not lux
            {updatedAt && <> · updated {updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</>}
          </p>
        </footer>
      </aside>
    </main>
  );
}

function StatCard({ value, label, loading }: { value: string; label: string; loading: boolean }) {
  return (
    <div className="lr-stat">
      <div className={`data lr-stat-value${loading ? " lr-skeleton" : ""}`}>{loading ? "00" : value}</div>
      <div className="lr-stat-label">{label}</div>
    </div>
  );
}
