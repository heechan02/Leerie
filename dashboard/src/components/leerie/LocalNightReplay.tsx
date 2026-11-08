"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, ScaleControl, Popup, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle } from "@/lib/map/style";
import { NIGHT, GPS_ACCURACY } from "@/lib/map/tokens";
import { timeLabel, nearestVisibleSample, sampleKey, type TimedPoint, type NightJourney, type ReplayDiagnostics } from "@/lib/leerie/replay";
import { ReplayStory } from "./ReplayStory";
import { useNightPlayback } from "./useNightPlayback";
import "./replay.css";
import "./replay-debug.css";

if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export function LocalNightReplay({ journey, diagnostics }: { journey: NightJourney; diagnostics?: ReplayDiagnostics }) {
  const { time, setTime, playing, setPlaying, speed, setSpeed, finished, frame, heads, rawPoints, trailTime, sampleTime } = useNightPlayback(journey);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [gpsHover, setGpsHover] = useState<{ lng: number; lat: number; accuracy: number | null } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(Boolean(diagnostics));
  const [debugPoint, setDebugPoint] = useState<TimedPoint | null>(null);
  const [debugPinned, setDebugPinned] = useState(false);
  const debug = debugPoint ? diagnostics?.points[sampleKey(debugPoint)] : undefined;
  const inspect = (event: MapLayerMouseEvent, pin = false) => {
    if (!debugEnabled || !diagnostics || (debugPinned && !pin)) return;
    const feature = event.features?.[0];
    const index = feature?.properties?.pathIndex;
    const path = index != null ? journey.paths[Number(index)] : undefined;
    const visibleTime = feature?.layer.id === "raw-sample-dots" ? sampleTime : trailTime;
    const nearest = path ? nearestVisibleSample(path, visibleTime, event.point, p => event.target.project(p)) : null;
    setDebugPoint(nearest);
    if (pin) { setDebugPinned(Boolean(nearest)); setPlaying(false); }
  };
  const map = useRef<MapRef>(null);
  const style = useMemo(() => buildMapStyle({ ...NIGHT, action: NIGHT.lit, committed: NIGHT.lit }), []);
  const histogram = useMemo(() => {
    const bins = Array(96).fill(0) as number[];
    for (const p of journey.paths.flat()) bins[Math.min(95, Math.floor((p[0] - journey.start) / (journey.end - journey.start) * 96))]++;
    return bins.map(n => 8 + n / Math.max(1, ...bins) * 92);
  }, [journey]);
  const progress = (time - journey.start) / (journey.end - journey.start);
  const fit = () => {
    const pts = journey.paths.flat();
    const xs = pts.map(p => p[1]), ys = pts.map(p => p[2]);
    map.current?.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: window.innerWidth < 700 ? 230 : 110, bottom: journey.unfiltered ? 390 : window.innerWidth < 700 ? 310 : 280, left: 45, right: window.innerWidth < 700 ? 45 : 390 }, duration: 0 });
  };
  return <main className="lr-app replay-app">
    <Map ref={map} mapStyle={style} initialViewState={{ longitude: -3.186, latitude: 55.937, zoom: 13.5 }} style={{ position: "absolute", inset: 0 }} dragRotate={false}
      interactiveLayerIds={[...(debugEnabled ? ["trail-hit"] : []), ...(journey.unfiltered ? ["raw-sample-dots"] : [])]}
      onClick={event => inspect(event, true)}
      onMouseMove={event => {
        inspect(event);
        const feature = event.features?.[0];
        setGpsHover(feature ? { lng: event.lngLat.lng, lat: event.lngLat.lat, accuracy: feature.properties?.accuracy_m ?? null } : null);
      }}
      onMouseLeave={() => { setGpsHover(null); if (!debugPinned) setDebugPoint(null); }}
      onLoad={() => { setReady(true); fit(); }} onError={() => setMapError(true)}>
      <Source id="replay-trails" type="geojson" data={frame.trails}>
        <Layer id="trail-glow" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": NIGHT.lamp, "line-width": 13, "line-blur": 9, "line-opacity": journey.unfiltered ? .12 : .45 }} />
        <Layer id="trail-hit" type="line" layout={{ "line-cap": "round" }} paint={{ "line-width": 20, "line-opacity": .01 }} />
        <Layer id="trail-core" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": NIGHT.lamp, "line-width": 2.5, "line-opacity": journey.unfiltered ? .22 : .85 }} />
      </Source>
      {journey.unfiltered && <Source id="raw-samples" type="geojson" data={rawPoints}><Layer id="raw-sample-dots" type="circle" paint={{ "circle-color": ["case", ["==", ["get", "accuracy_m"], null], GPS_ACCURACY.unknown,
          ["interpolate", ["linear"], ["number", ["get", "accuracy_m"], 30], 5, GPS_ACCURACY.good, 15, GPS_ACCURACY.medium, 30, GPS_ACCURACY.poor]], "circle-radius": 2.3, "circle-opacity": .9 }} /></Source>}
      {heads.map(({ pathIndex, coordinates: [longitude, latitude] }) => (
        <Marker key={pathIndex} longitude={longitude} latitude={latitude} subpixelPositioning style={{ pointerEvents: "none" }}>
          <span className="replay-rider" aria-hidden />
        </Marker>
      ))}
      {gpsHover && !debugEnabled && <Popup longitude={gpsHover.lng} latitude={gpsHover.lat} closeButton={false} closeOnClick={false} offset={12} className="replay-gps-popup"><span className="data">GPS accuracy: {gpsHover.accuracy == null ? "unknown" : `${Number(gpsHover.accuracy).toFixed(1)} m`}</span></Popup>}
      {debugPoint && <Source id="debug-selected-point" type="geojson" data={{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [debugPoint[1], debugPoint[2]] } }}><Layer id="debug-point-ring" type="circle" paint={{ "circle-radius": 8, "circle-color": NIGHT.ground, "circle-opacity": .85, "circle-stroke-color": NIGHT.picked, "circle-stroke-width": 2 }} /></Source>}
      <ScaleControl position="bottom-right" unit="metric" />
    </Map>
    <div className="replay-vignette" />
    <header className="replay-header">
      <Link href="/" className="lr-wordmark"><span className="lr-lamp" /><span>Leerie</span></Link>
      <span className="micro secondary">Edinburgh · {journey.unfiltered ? "Selected recordings" : "Night archive"}</span>
      {diagnostics && <button className="replay-text-button replay-debug-toggle" aria-pressed={debugEnabled} onClick={() => { setDebugEnabled(!debugEnabled); setDebugPoint(null); setDebugPinned(false); }}>Map diagnostics {debugEnabled ? "on" : "off"}</button>}
      {diagnostics && <button className="replay-text-button" onClick={() => { setTime(journey.end); setPlaying(false); setDebugPoint(null); setDebugPinned(false); }}>Show all points</button>}
      <Link href="/map" className="replay-map-link">Explore the map ↗</Link>
    </header>
    <ReplayStory journey={journey} km={frame.km} activeTrails={heads.length} hidden={Boolean(debugPoint)} />
    {debugPoint && <aside className="replay-debug-panel lr-glass" aria-label="Map inclusion diagnostics">
      <div className="replay-debug-heading"><span className="micro">Local map diagnostics</span><button className="replay-text-button" onClick={() => { setDebugPoint(null); setDebugPinned(false); }}>{debugPinned ? "Unpin ×" : "Close ×"}</button></div>
      <h2 className="display">{debug ? debug.included ? "Included on map" : "Excluded from map" : "Diagnostics unavailable"}</h2>
      <p className="replay-debug-hint">{debugPinned ? "Pinned to this real reading." : "Hover a trail · click to pin and pause."}</p>
      {debug ? <>
        <div className="data replay-debug-time">{timeLabel(Date.parse(debug.recorded_at) / 1000)} GMT</div>
        <ul className="replay-debug-blockers">{debug.blockers.length ? debug.blockers.map(reason => <li key={reason}>{reason}</li>) : <li>Passes every current map inclusion rule.</li>}</ul>
        <dl className="replay-debug-values">
          <dt>Selected time window</dt><dd>Pass</dd>
          <dt>GPS accuracy</dt><dd>{debug.accuracy_m == null ? "Missing" : `${debug.accuracy_m.toFixed(2)} m`} / ≤{diagnostics?.thresholds.gps_accuracy_m} m</dd>
          <dt>Reported speed</dt><dd>{debug.speed_mps == null ? "Missing" : `${debug.speed_mps.toFixed(2)} m/s`} · no limit</dd>
          <dt>Relative brightness</dt><dd>{debug.brightness == null ? "Missing" : debug.brightness.toPrecision(5)} · must be &gt;0</dd>
          <dt>Nearest imported street</dt><dd>{debug.nearest_street ?? "None"}</dd>
          <dt>Distance to street</dt><dd>{debug.distance_m == null ? "Unknown" : `${debug.distance_m.toFixed(1)} m`} / ≤{diagnostics?.thresholds.match_m} m</dd>
          <dt>Eligible street readings</dt><dd>{debug.eligible_readings ?? "Not matched"} / ≥{diagnostics?.thresholds.min_readings}</dd>
          <dt>Distinct sessions on street</dt><dd>{debug.passes ?? "Not matched"}</dd>
          <dt>Saved network bounds</dt><dd>{debug.outside_network_bounds ? "Outside extent" : "Inside extent (street may still be missing)"}</dd>
          <dt>OSM way ID</dt><dd>{debug.osm_way_id ?? "None"}</dd>
          <dt>Coordinates</dt><dd>{debug.lat.toFixed(6)}, {debug.lng.toFixed(6)}</dd>
          <dt>Phone</dt><dd>{debug.device_model || "Not recorded"}</dd>
          <dt>ISO / shutter / aperture</dt><dd>{debug.iso ?? "—"} / {debug.exposure_s ?? "—"} s / f/{debug.aperture ?? "—"}</dd>
        </dl>
        <p className="replay-debug-hint">Nearest real recorded sample on the hovered trail, not an interpolated position. Included readings colour their entire imported OSM way; predictions use measured neighbours within 150 m of a way&apos;s midpoint.</p>
        <p className="replay-debug-hint">Snapshot: {diagnostics ? timeLabel(Date.parse(diagnostics.generated_at) / 1000) : "—"} GMT · local pipeline rules</p>
      </> : <p>Regenerate diagnostics with <code>python3 -m pipeline.replay_debug</code>.</p>}
    </aside>}
    <section className="replay-transport lr-glass" aria-label="Night replay controls">
      {journey.unfiltered && <div className="replay-gps-legend" aria-label="GPS accuracy colour scale">
        <span className="micro">GPS accuracy <small>lower is better</small></span>
        <div className="replay-gps-ramp" />
        <div className="replay-gps-labels data"><span>≤5 m · green</span><span>15 m</span><span>≥30 m · red</span></div>
        <span className="replay-gps-unknown">Grey = unknown · hover a trail for map blockers · all selected points retained</span>
      </div>}
      <div className="replay-clock-row"><span className="micro secondary">{journey.unfiltered ? (finished ? "Recording complete" : playing ? "Replaying selected points" : "Selected time replay") : (finished ? "Night complete" : playing ? "Replaying the night" : "Night replay")}</span><output className="data replay-clock" aria-label="Replay time">{timeLabel(time)} <small>GMT</small></output></div>
      <div className="replay-timeline">
        <div className="replay-histogram" aria-hidden>{histogram.map((height, i) => <i key={i} style={{ height: `${height}%`, opacity: i / 96 <= progress ? 1 : .2 }} />)}</div>
        <div className="replay-playhead" style={{ left: `${progress * 100}%` }} aria-hidden />
        <input aria-label="Replay position" type="range" min={journey.start} max={journey.end} step="any" value={time} onChange={e => { setTime(Number(e.target.value)); setPlaying(false); }} />
      </div>
      <div className="replay-timeline-labels data"><span>{timeLabel(journey.start).slice(0, 5)}</span><span>Recording activity</span><span>{timeLabel(journey.end).slice(0, 5)}</span></div>
      <div className="replay-buttons">
        <button className="lr-button" disabled={!ready} onClick={() => { if (finished) setTime(journey.start); setPlaying(!playing || finished); }}>{playing && !finished ? "Ⅱ Pause" : finished ? "↺ Play again" : journey.unfiltered ? "▶ Play all" : "▶ Play night"}</button>
        <button className="replay-text-button" onClick={() => { setPlaying(false); setTime(journey.start); }}>Restart</button>
        <label className="replay-speed">Speed <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[120, 240, 480].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>
        <button className="replay-text-button replay-fit" onClick={fit}>Fit trails ↗</button>
      </div>
      {mapError && <p role="status" className="replay-caption">Some map tiles could not load. Travel trails remain available; check your connection for street labels.</p>}
      {!ready && <p role="status" className="replay-caption">Preparing the night map…</p>}
    </section>
  </main>;
}
