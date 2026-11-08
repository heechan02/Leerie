// Council planner (brief v2, "Decisions"): a budget turns into the streets to light first,
// plus Scan next (where one more walk would most change the plan) and Inspect first.
// Pure functions over segments.geojson features, so the browser runs it with no server.
import { score, type Weights } from "@/components/leerie/score";

export type PlanSegment = {
  segment_id: string; name: string | null; measured: boolean; length_m: number;
  L: number | null; R: number; C: number | null;
  brightness_stops: number | null; brightness_lo: number | null; brightness_hi: number | null;
  usage?: number | null; inspect?: boolean;
};
export type PlanFeature = GeoJSON.Feature<GeoJSON.LineString, PlanSegment>;
/** [west, south, east, north] */
export type Box = [number, number, number, number];
export type PlanInput = { budget: number; costPerLight: number; spacingM: number; weights: Weights };

export type Pick = { segment_id: string; name: string | null; lights: number; cost: number; gain: number };
export type ScanNext = { segment_id: string; name: string | null; pDark: number; value: number };
export type Plan = {
  picks: Pick[]; spend: number;
  /** Length-weighted mean score of the scored streets in the box, before and after the picks. */
  scoreBefore: number | null; scoreAfter: number | null;
  scanNext: ScanNext[]; inspect: { segment_id: string; name: string | null }[];
};

/** A lit street reaches the upper quartile of light rank: "a typical well-lit street". */
export const LIT_L = 0.75;
/** Dark means at least 1 stop (half the light) below the median measured street. */
export const DARK_STOPS = -1;
const Z80 = 1.2816; // the 80% interval spans ±1.2816 standard deviations
const SCAN_NEXT_COUNT = 5;

export function inBox(f: PlanFeature, [w, s, e, n]: Box): boolean {
  return f.geometry.coordinates.some(([x, y]) => x >= w && x <= e && y >= s && y <= n);
}

// shortcut: usage is null until the pipeline samples trips, so every street counts equally; upgrade when `usage` ships.
const usage = (p: PlanSegment) => p.usage ?? 1;

/** Score points gained if this street were lit to LIT_L, at the council's weights. */
function gain(p: PlanSegment, w: Weights): number {
  if (p.L == null || p.L >= LIT_L) return 0;
  return (score({ ...p, L: LIT_L }, w) ?? 0) - (score(p, w) ?? 0);
}

/** Chance the street is darker than DARK_STOPS, reading its 80% interval as a normal distribution. */
export function pDark(p: PlanSegment): number | null {
  const { brightness_stops: m, brightness_lo: lo, brightness_hi: hi } = p;
  if (m == null || lo == null || hi == null) return null;
  const sd = (hi - lo) / (2 * Z80);
  if (sd <= 0) return m < DARK_STOPS ? 1 : 0;
  return normalCdf((DARK_STOPS - m) / sd);
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26, error < 1.5e-7.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function meanScore(segs: PlanSegment[], w: Weights, lit: Set<string>): number | null {
  let sum = 0, len = 0;
  for (const p of segs) {
    const s = score(lit.has(p.segment_id) ? { ...p, L: Math.max(p.L ?? 0, LIT_L) } : p, w);
    if (s == null) continue;
    sum += s * p.length_m;
    len += p.length_m;
  }
  return len > 0 ? sum / len : null;
}

export function plan(features: PlanFeature[], box: Box, input: PlanInput): Plan {
  const { budget, costPerLight, spacingM, weights } = input;
  const segs = features.filter((f) => inBox(f, box)).map((f) => f.properties);

  // Greedy by benefit per pound: benefit = score gain × usage × length.
  const candidates = segs
    .map((p) => {
      const lights = Math.max(1, Math.ceil(p.length_m / spacingM));
      const g = gain(p, weights);
      return { p, lights, cost: lights * costPerLight, gain: g, benefit: g * usage(p) * p.length_m };
    })
    .filter((c) => c.benefit > 0 && c.cost > 0)
    .sort((a, b) => b.benefit / b.cost - a.benefit / a.cost);

  const picks: Pick[] = [];
  let spend = 0;
  for (const c of candidates) {
    if (spend + c.cost > budget) continue; // a cheaper street further down may still fit
    spend += c.cost;
    picks.push({ segment_id: c.p.segment_id, name: c.p.name, lights: c.lights, cost: c.cost, gain: c.gain });
  }

  const scanNext = segs
    .filter((p) => !p.measured)
    .map((p) => {
      const pd = pDark(p);
      return pd == null ? null : { segment_id: p.segment_id, name: p.name, pDark: pd,
        value: pd * (1 - pd) * gain(p, weights) * usage(p) * p.length_m };
    })
    .filter((s): s is ScanNext => s != null && s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, SCAN_NEXT_COUNT);

  return {
    picks, spend,
    scoreBefore: meanScore(segs, weights, new Set()),
    scoreAfter: meanScore(segs, weights, new Set(picks.map((p) => p.segment_id))),
    scanNext,
    inspect: segs.filter((p) => p.inspect).map((p) => ({ segment_id: p.segment_id, name: p.name })),
  };
}
