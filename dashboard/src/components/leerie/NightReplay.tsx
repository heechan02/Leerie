"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Source, ScaleControl, Popup, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle } from "@/lib/map/style";
import { NIGHT, GPS_ACCURACY } from "@/lib/map/tokens";
import { replayFrame, timeLabel, type NightJourney } from "@/lib/leerie/replay";
import "./replay.css";

if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export function NightReplay({ journey }: { journey: NightJourney }) {
  const [time, setTime] = useState(journey.start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(240);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [gpsHover, setGpsHover] = useState<{ lng: number; lat: number; accuracy: number | null } | null>(null);
  const map = useRef<MapRef>(null);
  const style = useMemo(() => buildMapStyle({ ...NIGHT, action: NIGHT.lit, committed: NIGHT.lit }), []);
  const rawPoints = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => ({ type: "FeatureCollection", features: journey.unfiltered ? journey.paths.flat().filter(p => p[0] <= time).map(p => ({ type: "Feature", properties: { accuracy_m: p[3] != null && p[3] >= 0 ? p[3] : null }, geometry: { type: "Point", coordinates: [p[1], p[2]] } })) : [] }), [journey, time]);
  const frame = useMemo(() => replayFrame(journey.paths, time), [journey.paths, time]);
  const histogram = useMemo(() => {
    const bins = Array(96).fill(0) as number[];
    for (const p of journey.paths.flat()) bins[Math.min(95, Math.floor((p[0] - journey.start) / (journey.end - journey.start) * 96))]++;
    return bins.map(n => 8 + n / Math.max(1, ...bins) * 92);
  }, [journey]);
  const finished = time >= journey.end;
  useEffect(() => {
    if (!playing || finished) return;
    let id: number;
    let last = performance.now();
    let accumulated = 0;
    const tick = (now: number) => {
      accumulated += (now - last) / 1000; last = now;
      if (accumulated >= .05) {
        const delta = accumulated * speed; accumulated = 0;
        setTime(t => Math.min(journey.end, t + delta));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, journey.end, finished]);
  const progress = (time - journey.start) / (journey.end - journey.start);
  const date = new Date(journey.start * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  const fit = () => {
    const pts = journey.paths.flat();
    const xs = pts.map(p => p[1]), ys = pts.map(p => p[2]);
    map.current?.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: window.innerWidth < 700 ? 230 : 110, bottom: journey.unfiltered ? 390 : window.innerWidth < 700 ? 310 : 280, left: 45, right: window.innerWidth < 700 ? 45 : 390 }, duration: 0 });
  };
  return <main className="lr-app replay-app">
    <Map ref={map} mapStyle={style} initialViewState={{ longitude: -3.186, latitude: 55.937, zoom: 13.5 }} style={{ position: "absolute", inset: 0 }} dragRotate={false}
      interactiveLayerIds={journey.unfiltered ? ["raw-sample-dots"] : []}
      onMouseMove={event => {
        const feature = event.features?.[0];
        setGpsHover(feature ? { lng: event.lngLat.lng, lat: event.lngLat.lat, accuracy: feature.properties?.accuracy_m ?? null } : null);
      }}
      onMouseLeave={() => setGpsHover(null)}
      onLoad={() => { setReady(true); fit(); }} onError={() => setMapError(true)}>
      <Source id="replay-trails" type="geojson" data={frame.trails}>
        <Layer id="trail-glow" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": NIGHT.lamp, "line-width": 13, "line-blur": 9, "line-opacity": journey.unfiltered ? .12 : .45 }} />
        <Layer id="trail-core" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": NIGHT.lamp, "line-width": 2.5, "line-opacity": journey.unfiltered ? .22 : .85 }} />
      </Source>
      {journey.unfiltered && <Source id="raw-samples" type="geojson" data={rawPoints}><Layer id="raw-sample-dots" type="circle" paint={{ "circle-color": ["case", ["==", ["get", "accuracy_m"], null], GPS_ACCURACY.unknown,
          ["interpolate", ["linear"], ["number", ["get", "accuracy_m"], 30], 5, GPS_ACCURACY.good, 15, GPS_ACCURACY.medium, 30, GPS_ACCURACY.poor]], "circle-radius": 2.3, "circle-opacity": .9 }} /></Source>}
      <Source id="replay-heads" type="geojson" data={frame.heads}>
        <Layer id="walker-halo" type="circle" paint={{ "circle-color": NIGHT.lit, "circle-radius": 19, "circle-blur": 1, "circle-opacity": .65 }} />
        <Layer id="walker-core" type="circle" paint={{ "circle-color": NIGHT.picked, "circle-radius": 4, "circle-stroke-color": NIGHT.lamp, "circle-stroke-width": 2 }} />
      </Source>
      {gpsHover && <Popup longitude={gpsHover.lng} latitude={gpsHover.lat} closeButton={false} closeOnClick={false} offset={12} className="replay-gps-popup"><span className="data">GPS accuracy: {gpsHover.accuracy == null ? "unknown" : `${Number(gpsHover.accuracy).toFixed(1)} m`}</span></Popup>}
      <ScaleControl position="bottom-right" unit="metric" />
    </Map>
    <div className="replay-vignette" />
    <header className="replay-header">
      <Link href="/" className="lr-wordmark"><span className="lr-lamp" /><span>Leerie</span></Link>
      <span className="micro secondary">Edinburgh · {journey.unfiltered ? "Selected recordings" : "Night archive"}</span>
      <Link href="/map" className="replay-map-link">Explore the map ↗</Link>
    </header>
    <aside className="replay-story lr-glass">
      <span className="micro replay-eyebrow">{date} · {journey.unfiltered ? "All GPS fixes" : "GPS filtered"}</span>
      <Link className="replay-view-link" href={journey.unfiltered ? "/replay" : "/replay?view=raw"}>{journey.unfiltered ? "View GPS filtered replay ↗" : "View all selected GPS fixes ↗"}</Link>
      <h1 className={`display ${journey.unfiltered ? "replay-raw-title" : ""}`}>{journey.unfiltered ? <>Every point.<br />Selected times.</> : <>A night<br />on foot.</>}</h1>
      <p>We walked the streets.<br />The city came to light.</p>
      <div className="replay-rule" />
      <div className="replay-metrics">
        <div><strong className="data">{frame.km.toFixed(1)}<small> km</small></strong><span>combined trails · approx.</span></div>
        <div><strong className="data">{frame.heads.features.length.toString().padStart(2, "0")}</strong><span>active recording trails</span></div>
      </div>
      <p className="replay-caption">{journey.unfiltered ? "All GPS fixes within your three selected windows, including drift and jumps. Trails stay separate across excluded times." : "Amber traces the walks as they happened. White lights mark the latest positions."}</p>
      {journey.selection && <details className="replay-window-details"><summary>3 selected windows · GMT</summary><p>{journey.selection.windows.map(([start, end]) => <span key={start} style={{ display: "block" }} className="data">{start}–{end}</span>)}</p></details>}
      <details><summary>About this recording</summary><p>{journey.readings.toLocaleString("en-GB")} {journey.unfiltered ? "selected, GPS-unfiltered" : "selected night"} readings across {journey.sessions} recording sessions. {journey.note} Distances sum all recording trails, including repeat passes and phones walking together; they are approximate. Source: Supabase light readings. All times GMT.</p></details>
    </aside>
    <section className="replay-transport lr-glass" aria-label="Night replay controls">
      {journey.unfiltered && <div className="replay-gps-legend" aria-label="GPS accuracy colour scale">
        <span className="micro">GPS accuracy <small>lower is better</small></span>
        <div className="replay-gps-ramp" />
        <div className="replay-gps-labels data"><span>≤5 m · green</span><span>15 m</span><span>≥30 m · red</span></div>
        <span className="replay-gps-unknown">Grey = unknown · hover a point for metres · all selected points retained</span>
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
        <button className="replay-text-button replay-fit" onClick={fit}>Fit walks ↗</button>
      </div>
      {mapError && <p role="status" className="replay-caption">Some map tiles could not load. Travel trails remain available; check your connection for street labels.</p>}
      {!ready && <p role="status" className="replay-caption">Preparing the night map…</p>}
    </section>
  </main>;
}
