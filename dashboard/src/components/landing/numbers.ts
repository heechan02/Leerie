// Survey totals use the same published data files as the map.
import type { SegmentProps } from "@/components/leerie/types";
import type { RecordingSelection } from "@/lib/leerie/replay";

type Street = SegmentProps & { expected_stops?: number | null; lamp_refs?: string[] };
type Segments = GeoJSON.FeatureCollection<GeoJSON.LineString, Street> & { recording_selection?: RecordingSelection };

export type Numbers = {
  readings: number; measured: number; predicted: number; km: number; lamps: number; reports: number;
  network: number; confirmed: number; selection?: RecordingSelection;
  inspect: { id: string; name: string; darker: number; lamps: string[] }[];
};

async function loadData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-cache", signal });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

export async function loadNumbers(signal: AbortSignal): Promise<Numbers> {
  const [segments, lamps] = await Promise.all([
    loadData<Segments>("/data/segments.geojson", signal),
    loadData<GeoJSON.FeatureCollection>("/data/lamps.geojson", signal),
  ]);
  const streets = segments.features.map((f) => f.properties);
  const measured = streets.filter((p) => p.measured);
  return {
    readings: measured.reduce((s, p) => s + p.n_readings, 0),
    measured: measured.length,
    predicted: streets.filter((p) => !p.measured && p.L != null).length,
    km: measured.reduce((s, p) => s + p.length_m, 0) / 1000,
    network: streets.length,
    selection: segments.recording_selection,
    lamps: lamps.features.length,
    reports: streets.reduce((s, p) => s + (p.reports_possible ?? 0) + (p.reports_confirmed ?? 0), 0),
    confirmed: streets.filter((p) => (p.reports_confirmed ?? 0) > 0).length,
    inspect: streets.flatMap((p) => p.inspect && p.brightness_stops != null && p.expected_stops != null
      ? [{ id: p.segment_id, name: p.name ?? "Unnamed street", darker: p.expected_stops - p.brightness_stops, lamps: p.lamp_refs ?? [] }]
      : [])
      .sort((a, b) => b.darker - a.darker),
  };
}
