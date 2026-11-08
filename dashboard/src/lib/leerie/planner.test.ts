import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/components/leerie/score";
import { DARK_STOPS, lightingHotspots, pDark, plan, type Box, type PlanFeature, type PlanSegment } from "./planner";

const BOX: Box = [-3.2, 55.9, -3.1, 56.0];
const METRES_PER_LNG = 111_320 * Math.cos(55.95 * Math.PI / 180);
const street = (id: string, p: Partial<PlanSegment>, lng = -3.15): PlanFeature => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: [[lng, 55.95], [lng + (p.length_m ?? 100) / METRES_PER_LNG, 55.95]] },
  properties: {
    segment_id: id, name: id, measured: true, length_m: 100, L: 0.5, R: 0.1, C: null,
    brightness_stops: 0, brightness_lo: -0.5, brightness_hi: 0.5, ...p,
  },
});
const input = { budget: 1000, costPerLight: 100, spacingM: 25, weights: DEFAULT_WEIGHTS };

describe("plan", () => {
  it("lights the darkest street per pound first and stays within budget", () => {
    const streets = [street("dim", { L: 0.4 }, -3.16), street("dark", { L: 0.1 })];
    const r = plan(streets, BOX, input);
    expect(r.picks.map((p) => p.segment_id)).toEqual(["dark", "dim"]);
    expect(r.spend).toBe(800);
    const partial = plan(streets, BOX, { ...input, budget: 500 });
    expect(partial.picks.map((p) => p.lights)).toEqual([4, 1]);
    expect(partial.spend).toBe(500);
  });

  it("funds individual sites on long streets and only credits the stretches served", () => {
    const long = street("long", { L: 0, length_m: 1000 });
    const partial = plan([long], BOX, input);
    const full = plan([long], BOX, { ...input, budget: 4000 });
    expect(partial.lamps).toHaveLength(10);
    expect(full.lamps).toHaveLength(40);
    expect(partial.scoreAfter! - partial.scoreBefore!).toBeCloseTo((full.scoreAfter! - full.scoreBefore!) / 4);
  });

  it("places sites along the part of a street that crosses the selection", () => {
    const crossing = street("crossing", { L: 0 });
    const west = crossing.geometry.coordinates[0][0] + 25 / METRES_PER_LNG;
    const east = west + 50 / METRES_PER_LNG;
    const r = plan([crossing], [west, BOX[1], east, BOX[3]], input);
    expect(r.lamps).toHaveLength(2);
    for (const { coordinates: [lng, lat] } of r.lamps) {
      expect(lng).toBeGreaterThan(west);
      expect(lng).toBeLessThan(east);
      expect(lat).toBe(55.95);
    }
    const positions = r.lamps.map((p) => p.coordinates[0]).sort((a, b) => a - b);
    expect((positions[1] - positions[0]) * METRES_PER_LNG).toBeCloseTo(25);
  });

  it("avoids existing posts and duplicate proposals across overlapping ways", () => {
    const dark = street("dark", { L: 0.1 });
    const overlapping = street("overlapping", { L: 0.3 });
    const existing = [-3.15 + 12.5 / METRES_PER_LNG, 55.95];
    const r = plan([dark, overlapping], BOX, { ...input, existingLamps: [existing] });
    expect(r.lamps).toHaveLength(3);
    expect(r.picks.map((p) => p.segment_id)).toEqual(["dark"]);
    expect(r.lamps.every((p) => Math.abs(p.coordinates[0] - existing[0]) * METRES_PER_LNG >= 12.5)).toBe(true);
  });

  it("ignores streets outside the box and streets already well lit", () => {
    const r = plan([street("outside", { L: 0 }, -3.5), street("bright", { L: 0.9 })], BOX, input);
    expect(r.picks).toEqual([]);
  });

  it("raises the area's mean score when it lights something", () => {
    const r = plan([street("dark", { L: 0.1 }), street("bright", { L: 0.9 })], BOX, input);
    expect(r.scoreAfter!).toBeGreaterThan(r.scoreBefore!);
  });

  it("sends scanners to predicted streets whose darkness is most uncertain", () => {
    const sure = street("sure-dark", { measured: false, L: 0.1, brightness_stops: -4, brightness_lo: -4.2, brightness_hi: -3.8 });
    const unsure = street("unsure", { measured: false, L: 0.3, brightness_stops: DARK_STOPS, brightness_lo: -3, brightness_hi: 1 });
    const walked = street("walked", { L: 0.3, brightness_stops: DARK_STOPS, brightness_lo: -3, brightness_hi: 1 });
    expect(plan([sure, unsure, walked], BOX, input).scanNext[0].segment_id).toBe("unsure");
  });
});

describe("pDark", () => {
  it("is one half on the threshold and null without an interval", () => {
    expect(pDark(street("x", { brightness_stops: DARK_STOPS, brightness_lo: -2, brightness_hi: 0 }).properties)).toBeCloseTo(0.5, 6);
    expect(pDark(street("x", { brightness_lo: null }).properties)).toBeNull();
  });
});

it("counts proposed posts across a named street's segments and keeps unnamed segments separate", () => {
  const features = [
    street("a", { name: "High Street", length_m: 90 }),
    street("b", { name: "High Street", length_m: 60 }, -3.15 + 90 / METRES_PER_LNG),
    street("c", { name: null, length_m: 90 }, -3.16),
    street("d", { name: null, length_m: 90 }, -3.17),
  ];
  expect(lightingHotspots(features)).toEqual([{ name: "High Street", lights: 5, segmentIds: expect.arrayContaining(["a", "b"]) }]);
  expect(lightingHotspots(features, [[-3.15 + 15 / METRES_PER_LNG, 55.95]])).toEqual([]);
});
