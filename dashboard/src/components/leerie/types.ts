// Properties of one street in data/segments.geojson (the contract in CLAUDE.md).
export type SegmentProps = {
  segment_id: string; name: string | null; highway: string; measured: boolean;
  n_readings: number; passes: number; length_m: number;
  brightness_stops: number | null; brightness_lo: number | null; brightness_hi: number | null;
  L: number | null; R: number; C: number | null; score: number | null; inspect?: boolean; forecast?: boolean;
  lamps_per_100m?: number | null;
};
