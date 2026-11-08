"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, ScaleControl, Popup, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle } from "@/lib/map/style";
import { NIGHT, GPS_ACCURACY } from "@/lib/map/tokens";
import { timeLabel, type NightJourney } from "@/lib/leerie/replay";
import { ReplayStory } from "./ReplayStory";
import { useNightPlayback } from "./useNightPlayback";
import "./replay.css";

if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export function NightReplay({ journey }: { journey: NightJourney }) {
  const { time, setTime, playing, setPlaying, speed, setSpeed, finished, frame, heads, rawPoints } = useNightPlayback(journey);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [gpsHover, setGpsHover] = useState<{ lng: number; lat: number; accuracy: number | null } | null>(null);
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
      {heads.map(({ pathIndex, coordinates: [longitude, latitude] }) => (
        <Marker key={pathIndex} longitude={longitude} latitude={latitude} subpixelPositioning style={{ pointerEvents: "none" }}>
          <span className="replay-rider" aria-hidden />
        </Marker>
      ))}
      {gpsHover && <Popup longitude={gpsHover.lng} latitude={gpsHover.lat} closeButton={false} closeOnClick={false} offset={12} className="replay-gps-popup"><span className="data">GPS accuracy: {gpsHover.accuracy == null ? "unknown" : `${Number(gpsHover.accuracy).toFixed(1)} m`}</span></Popup>}
      <ScaleControl position="bottom-right" unit="metric" />
    </Map>
    <div className="replay-vignette" />
    <header className="replay-header">
      <Link href="/" className="lr-wordmark"><span className="lr-lamp" /><span>Leerie</span></Link>
      <span className="micro secondary">Edinburgh · {journey.unfiltered ? "Selected recordings" : "Night archive"}</span>
      <Link href="/map" className="replay-map-link">Explore the map ↗</Link>
    </header>
    <ReplayStory journey={journey} km={frame.km} activeTrails={heads.length} />
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
        <button className="replay-text-button replay-fit" onClick={fit}>Fit trails ↗</button>
      </div>
      {mapError && <p role="status" className="replay-caption">Some map tiles could not load. Travel trails remain available; check your connection for street labels.</p>}
      {!ready && <p role="status" className="replay-caption">Preparing the night map…</p>}
    </section>
  </main>;
}
