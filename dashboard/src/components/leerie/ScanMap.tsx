"use client";
// The scan map: every street segment from data/segments.geojson, coloured by score,
// measured streets solid and predicted ones faded. Hover a street for its breakdown.
import { useEffect, useMemo, useState } from "react";
import Map, { Layer, Source, ScaleControl, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle } from "@/lib/map/style";
import { NIGHT } from "@/lib/map/tokens";
import { DEFAULT_WEIGHTS, score, type Weights } from "./score";

if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

type Props = {
  segment_id: string; name: string | null; highway: string; measured: boolean;
  n_readings: number; passes: number; length_m: number;
  brightness_stops: number | null; brightness_lo: number | null; brightness_hi: number | null;
  L: number | null; R: number; C: number | null; score: number | null; inspect?: boolean; forecast?: boolean;
  lamps_per_100m?: number | null;
};
type Segments = GeoJSON.FeatureCollection<GeoJSON.LineString, Props>;

const CENTER: [number, number] = [-3.181, 55.934]; // between George Square and King's Buildings

/** Real file first, the fake one until Dev B's pipeline writes it. */
async function loadSegments(): Promise<{ data: Segments; source: string }> {
  for (const file of ["segments.geojson", "segments.fake.geojson"]) {
    const res = await fetch(`/data/${file}`, { cache: "no-store" });
    if (res.ok) return { data: (await res.json()) as Segments, source: file };
  }
  throw new Error("No segments file in data/.");
}

const stops = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`);

export function ScanMap() {
  const [loaded, setLoaded] = useState<{ data: Segments; source: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [hover, setHover] = useState<Props | null>(null);

  useEffect(() => {
    loadSegments().then(setLoaded, (e: Error) => setError(e.message));
  }, []);

  // Recompute every score with the current weights; MapLibre colours by `_score`.
  const data = useMemo<Segments | null>(() => {
    if (!loaded) return null;
    return {
      ...loaded.data,
      features: loaded.data.features.map((f) => ({
        ...f,
        properties: { ...f.properties, _score: score(f.properties, weights) },
      })),
    };
  }, [loaded, weights]);

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

  const onHover = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    setHover(f ? (f.properties as Props) : null);
  };
  const hoverScore = hover ? score(hover, weights) : null;

  return (
    <main style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", height: "100vh" }}>
      <section style={{ position: "relative", minWidth: 0, background: NIGHT.ground }}>
        <Map
          initialViewState={{ longitude: CENTER[0], latitude: CENTER[1], zoom: 14.3 }}
          mapStyle={style}
          style={{ position: "absolute", inset: 0 }}
          dragRotate={false}
          interactiveLayerIds={["segments-hit"]}
          onMouseMove={onHover}
          onClick={onHover}
          onMouseLeave={() => setHover(null)}
          cursor={hover ? "pointer" : "grab"}
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
                  "line-width": ["interpolate", ["linear"], ["zoom"], 13, ["case", ["get", "measured"], 2, 1], 17, ["case", ["get", "measured"], 7, 3]],
                }}
              />
              {/* Wide invisible line so thin streets are easy to hover. */}
              {/* Opacity 0.01, not 0: MapLibre skips fully transparent layers when querying. */}
              <Layer id="segments-hit" type="line" paint={{ "line-width": 12, "line-opacity": 0.01 }} />
            </Source>
          )}
          <ScaleControl position="bottom-right" maxWidth={80} unit="metric" />
        </Map>
        {error && (
          <p className="data" style={{ position: "absolute", top: 16, left: 16, color: NIGHT.ink }}>{error}</p>
        )}
      </section>

      <aside style={{ background: "var(--surface)", borderLeft: "1px solid var(--rule)", padding: "var(--s5)", overflowY: "auto", display: "grid", gap: "var(--s5)", alignContent: "start" }}>
        <header>
          <h1 style={{ fontSize: "var(--t-title)" }}>Leerie</h1>
          <p className="secondary" style={{ margin: "var(--s1) 0 0", fontSize: "var(--t-small)" }}>
            Measured night light on Edinburgh streets, George Square to King&apos;s Buildings.
          </p>
          {loaded && (
            <p className="micro secondary" style={{ marginTop: "var(--s2)" }}>
              Source: data/{loaded.source}{loaded.source.includes("fake") ? " (placeholder values)" : ""}
            </p>
          )}
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--s2)" }}>
          <Stat value={String(counts.measured)} label="streets measured" />
          <Stat value={String(counts.predicted)} label="streets predicted" />
          <Stat value={counts.km.toFixed(1)} unit="km" label="measured" />
        </section>

        <section>
          <h2 className="micro">Hovered street</h2>
          {hover ? (
            <dl className="data" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--s1) var(--s3)", margin: "var(--s2) 0 0", fontSize: "var(--t-small)" }}>
              <dt>Street</dt><dd style={{ margin: 0 }}>{hover.name ?? "unnamed"} · {hover.highway}</dd>
              <dt>Status</dt><dd style={{ margin: 0 }}>{hover.measured ? `measured, ${hover.passes} passes, ${hover.n_readings} readings` : hover.L == null ? "not walked, no estimate yet" : "predicted from measured neighbours"}</dd>
              <dt>Light</dt><dd style={{ margin: 0 }}>{stops(hover.brightness_stops)} stops ({stops(hover.brightness_lo)} to {stops(hover.brightness_hi)}, 80%)</dd>
              <dt>L light</dt><dd style={{ margin: 0 }}>{hover.L == null ? "unknown" : `${hover.L.toFixed(2)} × ${weights.L.toFixed(2)}`}</dd>
              <dt>R reports</dt><dd style={{ margin: 0 }}>{hover.R.toFixed(2)} → (1 − R) × {weights.R.toFixed(2)}</dd>
              <dt>C area crime</dt><dd style={{ margin: 0 }}>{hover.C == null ? "unknown" : hover.C.toFixed(2)} → (1 − C) × {weights.C.toFixed(2)}</dd>
              <dt>Score</dt><dd style={{ margin: 0, fontWeight: 600 }}>{hoverScore == null ? "no estimate" : `${hoverScore.toFixed(0)} / 100`}</dd>
              {hover.inspect && (<><dt>Flag</dt><dd style={{ margin: 0 }}>lamped but darker than expected</dd></>)}
            </dl>
          ) : (
            <p className="secondary" style={{ fontSize: "var(--t-small)", margin: "var(--s2) 0 0" }}>Hover or tap a street to see its inputs.</p>
          )}
        </section>

        <section>
          <h2 className="micro">Score weights</h2>
          <p className="secondary" style={{ fontSize: "var(--t-small)", margin: "var(--s1) 0 var(--s2)" }}>
            Our choice, not a finding. Move them to see how the map changes.
          </p>
          {(["L", "R", "C"] as const).map((k) => (
            <label key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr 36px", alignItems: "center", gap: "var(--s2)", fontSize: "var(--t-small)" }}>
              {{ L: "Light", R: "Reports", C: "Area crime" }[k]}
              <input type="range" min={0} max={1} step={0.05} value={weights[k]}
                onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
              <span className="data">{weights[k].toFixed(2)}</span>
            </label>
          ))}
        </section>

        <section>
          <h2 className="micro">Legend</h2>
          <div style={{ height: 10, borderRadius: "var(--r-full)", margin: "var(--s2) 0 var(--s1)", background: `linear-gradient(90deg, ${NIGHT.dim}, ${NIGHT.mid}, ${NIGHT.lit})` }} />
          <div className="data secondary" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-micro)" }}>
            <span>score 0</span><span>50</span><span>100</span>
          </div>
          <p className="secondary" style={{ fontSize: "var(--t-small)", margin: "var(--s2) 0 0" }}>
            Solid: measured. Faded: predicted. Light is relative (stops: +1 = twice the median street), not lux.
          </p>
        </section>
      </aside>
    </main>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <div className="data" style={{ fontSize: "var(--t-lead)", fontWeight: 600 }}>
        {value}{unit && <span className="secondary" style={{ fontSize: "var(--t-micro)" }}> {unit}</span>}
      </div>
      <div className="secondary" style={{ fontSize: "var(--t-micro)" }}>{label}</div>
    </div>
  );
}
