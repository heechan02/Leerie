export type TimedPoint = [time: number, longitude: number, latitude: number, accuracyM?: number | null];
export type RecordingSelection = { date: string; timezone: string; windows: [string, string][] };
export type NightJourney = { selection?: RecordingSelection; unfiltered?: boolean; date: string; start: number; end: number; readings: number; sessions: number; paths: TimedPoint[][]; note: string };
export const timeLabel = (seconds: number) => new Date(seconds * 1000).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Clip each continuous recording at the clock; interpolate only inside that recording. */
export function replayFrame(paths: TimedPoint[][], time: number) {
  const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const heads: GeoJSON.Feature<GeoJSON.Point>[] = [];
  let km = 0;
  for (const [pathIndex, path] of paths.entries()) {
    const coords: number[][] = [];
    let lastTime = 0;
    for (let i = 0; i < path.length; i++) {
      const [t, lng, lat] = path[i];
      if (t > time) {
        if (i > 0 && coords.length) {
          const prev = path[i - 1];
          const f = (time - prev[0]) / (t - prev[0]);
          coords.push([prev[1] + (lng - prev[1]) * f, prev[2] + (lat - prev[2]) * f]);
          lastTime = time;
        }
        break;
      }
      coords.push([lng, lat]);
      lastTime = t;
    }
    if (coords.length > 1) {
      lines.push({ type: "Feature", properties: { pathIndex }, geometry: { type: "LineString", coordinates: coords } });
      for (let i = 1; i < coords.length; i++) {
        const [a, b] = [coords[i - 1], coords[i]];
        km += Math.hypot((b[0] - a[0]) * 62.4, (b[1] - a[1]) * 111.32);
      }
    }
    if (coords.length && time - lastTime < 30) heads.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coords[coords.length - 1] } });
  }
  return { trails: { type: "FeatureCollection" as const, features: lines }, heads: { type: "FeatureCollection" as const, features: heads }, km };
}

export type PointDiagnostic = {
  recorded_at: string; lng: number; lat: number; accuracy_m: number | null; speed_mps: number | null;
  brightness: number | null; iso: number | null; exposure_s: number | null; aperture: number | null; device_model: string | null;
  nearest_street: string | null; osm_way_id: number | null; distance_m: number | null;
  eligible_readings: number | null; passes: number | null; included: boolean; blockers: string[]; outside_network_bounds: boolean;
};
export type ReplayDiagnostics = { generated_at: string; points: Record<string, PointDiagnostic>; thresholds: { gps_accuracy_m: number; match_m: number; min_readings: number; speed_limit: null } };
export const sampleKey = (p: TimedPoint) => `${Math.round(p[0])}:${p[1].toFixed(6)}:${p[2].toFixed(6)}`;

/** Compare screen distance, so hovering between samples selects a real visible reading. */
export function nearestVisibleSample(path: TimedPoint[], time: number, cursor: { x: number; y: number }, project: (p: [number, number]) => { x: number; y: number }): TimedPoint | null {
  let nearest: TimedPoint | null = null, distance = Infinity;
  for (const p of path) {
    if (p[0] > time) continue;
    const screen = project([p[1], p[2]]);
    const d = (screen.x - cursor.x) ** 2 + (screen.y - cursor.y) ** 2;
    if (d < distance) { distance = d; nearest = p; }
  }
  return nearest;
}
