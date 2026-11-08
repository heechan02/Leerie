import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/components/leerie/score";
import { DARK_STOPS, pDark, plan, type Box, type PlanFeature, type PlanSegment } from "./planner";

const BOX: Box = [-3.2, 55.9, -3.1, 56.0];
const street = (id: string, p: Partial<PlanSegment>, lng = -3.15): PlanFeature => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: [[lng, 55.95], [lng + 0.001, 55.95]] },
  properties: {
    segment_id: id, name: id, measured: true, length_m: 100, L: 0.5, R: 0.1, C: null,
    brightness_stops: 0, brightness_lo: -0.5, brightness_hi: 0.5, ...p,
  },
});
const input = { budget: 1000, costPerLight: 100, spacingM: 25, weights: DEFAULT_WEIGHTS };

describe("plan", () => {
  it("lights the darkest street per pound first and stays within budget", () => {
    const r = plan([street("dim", { L: 0.4 }), street("dark", { L: 0.1 })], BOX, input); // 4 lights = £400 each
    expect(r.picks.map((p) => p.segment_id)).toEqual(["dark", "dim"]);
    expect(r.spend).toBe(800);
    expect(plan([street("dim", { L: 0.4 }), street("dark", { L: 0.1 })], BOX, { ...input, budget: 500 }).picks)
      .toHaveLength(1);
  });

  it("skips a street that does not fit and takes a cheaper one after it", () => {
    const long = street("long", { L: 0.0, length_m: 1000 }); // 40 lights, over budget
    const short = street("short", { L: 0.3 });
    expect(plan([long, short], BOX, input).picks.map((p) => p.segment_id)).toEqual(["short"]);
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
