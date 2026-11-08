export type TimedPoint = [time: number, longitude: number, latitude: number, accuracyM?: number | null];
export type RecordingSelection = { date: string; timezone: string; windows: [string, string][] };
export type NightJourney = { selection?: RecordingSelection; unfiltered?: boolean; date: string; start: number; end: number; readings: number; sessions: number; paths: TimedPoint[][]; note: string };
export const timeLabel = (seconds: number) => new Date(seconds * 1000).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Clip each continuous recording at the clock; interpolate only inside that recording. */
export function replayFrame(paths: TimedPoint[][], time: number) {
  const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const heads: GeoJSON.Feature<GeoJSON.Point>[] = [];
  let km = 0;
  for (const path of paths) {
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
      lines.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
      for (let i = 1; i < coords.length; i++) {
        const [a, b] = [coords[i - 1], coords[i]];
        km += Math.hypot((b[0] - a[0]) * 62.4, (b[1] - a[1]) * 111.32);
      }
    }
    if (coords.length && time - lastTime < 30) heads.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coords[coords.length - 1] } });
  }
  return { trails: { type: "FeatureCollection" as const, features: lines }, heads: { type: "FeatureCollection" as const, features: heads }, km };
}
