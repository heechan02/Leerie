import { useEffect, useMemo, useState } from "react";
import { replayFrame, replayHeads, type NightJourney } from "@/lib/leerie/replay";

export function useNightPlayback({ start, end, paths, unfiltered }: NightJourney) {
  const [time, setTime] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(480);
  const finished = time >= end;
  const active = playing && !finished;

  useEffect(() => {
    if (!active) return;
    let previous = performance.now();
    let id: number;
    const tick = (now: number) => {
      // Avoid a large jump if the browser suspended animation in a background tab.
      const delta = Math.max(0, Math.min(now - previous, 100)) * speed / 1000;
      previous = now;
      setTime((current) => Math.min(end, current + delta));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, speed, end]);

  // Move the markers each frame, while sending larger GeoJSON updates less often.
  const elapsed = time - start;
  const trailStep = speed / 30;
  const sampleStep = speed / 10;
  const trailTime = active ? start + Math.floor(elapsed / trailStep) * trailStep : time;
  const sampleTime = active ? start + Math.floor(elapsed / sampleStep) * sampleStep : time;
  const frame = useMemo(() => replayFrame(paths, trailTime), [paths, trailTime]);
  const heads = useMemo(() => replayHeads(paths, time), [paths, time]);
  const rawPoints = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => ({
    type: "FeatureCollection",
    features: unfiltered ? paths.flatMap((path, pathIndex) => path.filter(([t]) => t <= sampleTime)
      .map(([, lng, lat, accuracy]) => ({
        type: "Feature",
        properties: { pathIndex, accuracy_m: accuracy != null && accuracy >= 0 ? accuracy : null },
        geometry: { type: "Point", coordinates: [lng, lat] },
      }))) : [],
  }), [paths, sampleTime, unfiltered]);
  return { time, setTime, playing, setPlaying, speed, setSpeed, finished, frame, heads, rawPoints, trailTime, sampleTime };
}
