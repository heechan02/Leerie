export type TimedPoint = [time: number, longitude: number, latitude: number, accuracyM?: number | null];
export type RecordingSelection = { date: string; timezone: string; windows: [string, string][] };
export type NightJourney = { selection?: RecordingSelection; unfiltered?: boolean; date: string; start: number; end: number; readings: number; sessions: number; paths: TimedPoint[][]; note: string };
const clockFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const timeLabel = (seconds: number) => clockFormat.format(seconds * 1000);

function positionAt(path: TimedPoint[], time: number) {
  let start = 0, end = path.length;
  while (start < end) {
    const mid = Math.floor((start + end) / 2);
    if (path[mid][0] <= time) start = mid + 1;
    else end = mid;
  }
  if (start === 0) return null;
  const [lastTime, lng, lat] = path[start - 1];
  const next = path[start];
  if (next && time > lastTime) {
    const fraction = (time - lastTime) / (next[0] - lastTime);
    return { count: start, coordinates: [lng + (next[1] - lng) * fraction, lat + (next[2] - lat) * fraction] as [number, number], interpolated: true, active: true };
  }
  return { count: start, coordinates: [lng, lat] as [number, number], interpolated: false, active: time - lastTime < 30 };
}

/** Locate the moving markers without rebuilding or walking the trails on every animation frame. */
export function replayHeads(paths: TimedPoint[][], time: number) {
  return paths.flatMap((path, pathIndex) => {
    const position = positionAt(path, time);
    return position?.active ? [{ pathIndex, coordinates: position.coordinates }] : [];
  });
}

/** Clip each continuous recording at the clock; interpolate only inside that recording. */
export function replayFrame(paths: TimedPoint[][], time: number) {
  const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const heads: GeoJSON.Feature<GeoJSON.Point>[] = [];
  let km = 0;
  for (const [pathIndex, path] of paths.entries()) {
    const position = positionAt(path, time);
    if (!position) continue;
    const coords = path.slice(0, position.count).map(([, lng, lat]) => [lng, lat]);
    if (position.interpolated) coords.push(position.coordinates);
    if (coords.length > 1) {
      lines.push({ type: "Feature", properties: { pathIndex }, geometry: { type: "LineString", coordinates: coords } });
      for (let i = 1; i < coords.length; i++) {
        const [a, b] = [coords[i - 1], coords[i]];
        km += Math.hypot((b[0] - a[0]) * 62.4, (b[1] - a[1]) * 111.32);
      }
    }
    if (position.active) heads.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: position.coordinates } });
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
