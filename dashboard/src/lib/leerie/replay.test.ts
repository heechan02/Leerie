import { describe, expect, it } from "vitest";
import { replayFrame, replayHeads, timeLabel, type TimedPoint } from "./replay";
const walk: TimedPoint[] = [[0, -3.19, 55.94], [60, -3.18, 55.94]];
describe("night replay", () => {
  it("never reveals future travel", () => {
    const f = replayFrame([walk], -1);
    expect(f.trails.features).toHaveLength(0);
    expect(f.heads.features).toHaveLength(0);
    expect(f.km).toBe(0);
  });
  it("interpolates the current position and only counts travel so far", () => {
    const f = replayFrame([walk], 30);
    expect(f.heads.features[0].geometry.coordinates[0]).toBeCloseTo(-3.185);
    expect(replayHeads([walk], 30)[0].coordinates).toEqual(f.heads.features[0].geometry.coordinates);
    expect(f.km).toBeCloseTo(.312);
  });
  it("preserves a recording gap without a connecting line or a phantom walker", () => {
    const later: TimedPoint[] = [[300, -3.2, 55.93], [360, -3.19, 55.93]];
    expect(replayFrame([walk, later], 180).heads.features).toHaveLength(0);
    expect(replayHeads([walk, later], 180)).toEqual([]);
    const f = replayFrame([walk, later], 360);
    expect(f.trails.features).toHaveLength(2);
    expect(f.km).toBeCloseTo(1.248);
  });
  it("uses London time for the archive clock", () => {
    expect(timeLabel(Date.parse("2026-11-08T02:12:49Z") / 1000)).toBe("02:12:49");
  });
});

describe("diagnostic hover sample", () => {
  it("selects a real past point, never an interpolated or future sample", async () => {
    const { nearestVisibleSample, sampleKey } = await import("./replay");
    const path: TimedPoint[] = [[1, 1, 1], [10, 10, 10], [20, 20, 20]];
    const project = ([x, y]: [number, number]) => ({ x, y });
    expect(nearestVisibleSample(path, 15, { x: 19, y: 19 }, project)).toEqual(path[1]);
    expect(nearestVisibleSample(path, 0, { x: 0, y: 0 }, project)).toBeNull();
    expect(sampleKey([1794104657.798, -3.198713, 55.944395])).toBe("1794104658:-3.198713:55.944395");
  });
});
