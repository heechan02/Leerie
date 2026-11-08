// Last night's numbers for the landing page, read from the same data files as the map. Never typed in.
import type { SegmentProps } from "@/components/leerie/types";

type Street = SegmentProps & { expected_stops?: number | null; lamp_refs?: string[]; reports_possible?: number };

export type Numbers = {
  readings: number; measured: number; predicted: number; km: number; lamps: number; reports: number;
  inspect: { name: string; darker: number; lamps: string[] }[];
};

let cached: Promise<Numbers> | null = null;

/** One fetch per page, shared by every section that shows a number. */
export function loadNumbers(): Promise<Numbers> {
  cached ??= Promise.all([
    fetch("/data/segments.geojson").then((r) => r.json() as Promise<GeoJSON.FeatureCollection<GeoJSON.LineString, Street>>),
    fetch("/data/lamps.geojson").then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
  ]).then(([segments, lamps]) => {
    const fs = segments.features.map((f) => f.properties);
    const measured = fs.filter((p) => p.measured);
    return {
      readings: measured.reduce((s, p) => s + p.n_readings, 0),
      measured: measured.length,
      predicted: fs.filter((p) => !p.measured && p.L != null).length,
      km: measured.reduce((s, p) => s + p.length_m, 0) / 1000,
      lamps: lamps.features.length,
      reports: fs.reduce((s, p) => s + (p.reports_possible ?? 0) + (p.reports_confirmed ?? 0), 0),
      inspect: fs
        .filter((p) => p.inspect && p.brightness_stops != null && p.expected_stops != null)
        .map((p) => ({ name: p.name ?? "Unnamed street", darker: p.expected_stops! - p.brightness_stops!, lamps: p.lamp_refs ?? [] }))
        .sort((a, b) => b.darker - a.darker),
    };
  });
  return cached;
}
