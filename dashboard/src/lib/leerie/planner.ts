// Council planner: a budget turns into proposed lamp sites,
// plus Scan next (where one more walk would most change the plan) and Inspect first.
// Pure functions over segments.geojson features, so the browser runs it with no server.
import { LIGHT_ONLY_WEIGHTS, score, type Weights } from "@/components/leerie/score";

export type PlanSegment = {
  segment_id: string; name: string | null; measured: boolean; length_m: number;
  L: number | null; R: number; C: number | null;
  brightness_stops: number | null; brightness_lo: number | null; brightness_hi: number | null;
  usage?: number | null; inspect?: boolean;
  /** Council lamp asset IDs within 20 m, for the Inspect first list. */
  lamp_refs?: string[];
};
export type PlanFeature = GeoJSON.Feature<GeoJSON.LineString, PlanSegment>;
/** [west, south, east, north] */
export type Box = [number, number, number, number];
export type PlanInput = { budget: number; costPerLight: number; spacingM: number; weights: Weights; existingLamps?: GeoJSON.Position[] };
export const PLAN_DEFAULTS = { budget: 200_000, costPerLight: 1_000, spacingM: 30 };
export const HOTSPOT_MIN_POSTS = 5;

export type Pick = { segment_id: string; name: string | null; lights: number; cost: number; gain: number };
export type LightingHotspot = { name: string | null; lights: number; segmentIds: string[] };
export type LampSite = { segment_id: string; name: string | null; coordinates: GeoJSON.Position };
export type ScanNext = { segment_id: string; name: string | null; pDark: number; value: number };
export type Plan = {
  picks: Pick[]; spend: number;
  lamps: LampSite[];
  /** Length-weighted mean score of the scored streets in the box, before and after the picks. */
  scoreBefore: number | null; scoreAfter: number | null;
  scanNext: ScanNext[]; inspect: { segment_id: string; name: string | null; lamp_refs: string[] }[];
};

/** A lit street reaches the upper quartile of light rank: "a typical well-lit street". */
export const LIT_L = 0.75;
/** Dark means at least 1 stop (half the light) below the local reference median. */
export const DARK_STOPS = -1;
const Z80 = 1.2816; // the 80% interval spans ±1.2816 standard deviations
const SCAN_NEXT_COUNT = 5;

function interpolate(a: GeoJSON.Position, b: GeoJSON.Position, t: number): GeoJSON.Position {
  return t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Clip each edge to the box, keeping separate stretches if a street exits and re-enters. */
function clipLine(coordinates: GeoJSON.Position[], box: Box): GeoJSON.Position[][] {
  const parts: GeoJSON.Position[][] = [];
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i];
    let enter = 0, exit = 1;
    for (const axis of [0, 1]) {
      const delta = b[axis] - a[axis];
      if (delta === 0) {
        if (a[axis] < box[axis] || a[axis] > box[axis + 2]) exit = -1;
        continue;
      }
      const t0 = (box[axis] - a[axis]) / delta;
      const t1 = (box[axis + 2] - a[axis]) / delta;
      enter = Math.max(enter, Math.min(t0, t1));
      exit = Math.min(exit, Math.max(t0, t1));
    }
    if (enter >= exit || (a[0] === b[0] && a[1] === b[1])) continue;
    const start = interpolate(a, b, enter), end = interpolate(a, b, exit);
    const last = parts.at(-1);
    const tail = last?.at(-1);
    if (last && tail?.[0] === start[0] && tail[1] === start[1]) last.push(end);
    else parts.push([start, end]);
  }
  return parts;
}

/** Walk the centreline at equal intervals, placing one site in the middle of each stretch. */
function lampSites(part: GeoJSON.Position[], edgeLengths: number[], length: number, spacingM: number) {
  const count = Math.max(1, Math.round(length / spacingM));
  const step = length / count;
  let edge = 0, edgeStart = 0;
  return Array.from({ length: count }, (_, i) => {
    const at = (i + 0.5) * step;
    while (at > edgeStart + edgeLengths[edge]) edgeStart += edgeLengths[edge++];
    return { coordinates: interpolate(part[edge], part[edge + 1], (at - edgeStart) / edgeLengths[edge]),
      coveredM: Math.min(step, spacingM) };
  });
}

/** Index existing and selected posts so nearby candidates can be skipped across street boundaries. */
function lampIndex(radius: number) {
  const cells = new Map<string, GeoJSON.Position[]>();
  return {
    add(point: GeoJSON.Position) {
      const key = `${Math.floor(point[0] / radius)},${Math.floor(point[1] / radius)}`;
      const cell = cells.get(key);
      if (cell) cell.push(point);
      else cells.set(key, [point]);
    },
    near([x, y]: GeoJSON.Position) {
      const col = Math.floor(x / radius), row = Math.floor(y / radius);
      for (let i = col - 1; i <= col + 1; i++) {
        for (let j = row - 1; j <= row + 1; j++) {
          if (cells.get(`${i},${j}`)?.some(([px, py]) => Math.hypot(x - px, y - py) < radius)) return true;
        }
      }
      return false;
    },
  };
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

export function plan(features: PlanFeature[], box: Box, input: PlanInput): Plan {
  const { budget, costPerLight, spacingM, weights, existingLamps = [] } = input;
  // Local metres, using the middle latitude of the selected area.
  const lonScale = 111_320 * Math.cos((box[1] + box[3]) * Math.PI / 360);
  const latScale = 110_540;
  const project = ([x, y]: GeoJSON.Position): GeoJSON.Position => [(x - box[0]) * lonScale, (y - box[1]) * latScale];
  const segs = [];
  const candidates = [];
  let scoredM = 0, baseline = 0;
  const affordable = Number.isFinite(budget) && costPerLight > 0 && budget >= costPerLight
    ? Math.floor(budget / costPerLight)
    : 0;
  for (const feature of features) {
    const p = feature.properties;
    const parts = clipLine(feature.geometry.coordinates, box).map((part) => {
      const edges = part.slice(1).map(([x, y], i) =>
        Math.hypot((x - part[i][0]) * lonScale, (y - part[i][1]) * latScale));
      return { part, edges, length: edges.reduce((sum, edge) => sum + edge, 0) };
    });
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    if (length <= 0) continue;
    segs.push(p);
    const current = score(p, weights);
    if (current == null) continue;
    scoredM += length;
    baseline += current * length;
    const g = gain(p, weights);
    const priority = g * usage(p);
    if (priority <= 0 || !affordable || !Number.isFinite(spacingM) || spacingM < 1) continue;
    for (const part of parts) {
      if (part.length <= 0) continue;
      for (const site of lampSites(part.part, part.edges, part.length, spacingM)) {
        const improvement = g * site.coveredM;
        candidates.push({ p, length, coordinates: site.coordinates, improvement, benefit: priority * site.coveredM });
      }
    }
  }

  // A post improves only its own stretch. Rank sites by that gain, since every post costs the same.
  candidates.sort((a, b) => b.benefit - a.benefit);
  const posts = lampIndex(Math.max(1, spacingM) / 2);
  if (candidates.length) for (const coordinates of existingLamps) posts.add(project(coordinates));
  const lamps: LampSite[] = [];
  const picks = new Map<string, Pick>();
  let improvement = 0;
  for (const c of candidates) {
    if (lamps.length >= affordable) break;
    const point = project(c.coordinates);
    if (posts.near(point)) continue;
    posts.add(point);
    const { segment_id, name } = c.p;
    lamps.push({ segment_id, name, coordinates: c.coordinates });
    improvement += c.improvement;
    const pick = picks.get(segment_id) ?? { segment_id, name, lights: 0, cost: 0, gain: 0 };
    pick.lights++;
    pick.cost = pick.lights * costPerLight;
    pick.gain += c.improvement / c.length;
    picks.set(segment_id, pick);
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
    lamps, picks: [...picks.values()], spend: lamps.length * costPerLight,
    scoreBefore: scoredM > 0 ? baseline / scoredM : null,
    scoreAfter: scoredM > 0 ? (baseline + improvement) / scoredM : null,
    scanNext,
    inspect: segs.filter((p) => p.inspect).map((p) => ({ segment_id: p.segment_id, name: p.name, lamp_refs: p.lamp_refs ?? [] })),
  };
}

/** Find streets with multiple priority sites in the default plan for the whole survey. */
export function lightingHotspots(features: PlanFeature[], existingLamps?: GeoJSON.Position[]): LightingHotspot[] {
  const bounds: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { geometry } of features) {
    for (const [lng, lat] of geometry.coordinates) {
      bounds[0] = Math.min(bounds[0], lng);
      bounds[1] = Math.min(bounds[1], lat);
      bounds[2] = Math.max(bounds[2], lng);
      bounds[3] = Math.max(bounds[3], lat);
    }
  }
  if (!bounds.every(Number.isFinite)) return [];

  const { picks } = plan(features, bounds, { ...PLAN_DEFAULTS, weights: LIGHT_ONLY_WEIGHTS, existingLamps });
  const streets = new Map<string, LightingHotspot>();
  for (const { name, segment_id, lights } of picks) {
    // OSM splits named streets into multiple segments. Keep unnamed segments separate.
    const key = name ? `street:${name}` : `segment:${segment_id}`;
    const street = streets.get(key) ?? { name, lights: 0, segmentIds: [] };
    street.lights += lights;
    street.segmentIds.push(segment_id);
    streets.set(key, street);
  }
  return [...streets.values()].filter((street) => street.lights >= HOTSPOT_MIN_POSTS)
    .sort((a, b) => b.lights - a.lights);
}
