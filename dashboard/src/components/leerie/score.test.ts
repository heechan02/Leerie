import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, LIGHT_ONLY_WEIGHTS, score } from "./score";

describe("score", () => {
  it("matches the brief's formula at default weights", () => {
    expect(score({ L: 0.8, R: 0.1, C: 0.4 }, DEFAULT_WEIGHTS)).toBeCloseTo(100 * (0.4 + 0.27 + 0.12));
  });
  it("normalises weights that do not sum to 1", () => {
    expect(score({ L: 1, R: 1, C: 1 }, { L: 2, R: 0, C: 0 })).toBe(100);
  });
  it("treats unknown crime as the middle", () => {
    expect(score({ L: 0, R: 1, C: null }, { L: 0, R: 0, C: 1 })).toBe(50);
  });
});

describe("unknown light", () => {
  it("gives no score rather than 0", () => {
    expect(score({ L: null, R: 0.1, C: 0.2 }, DEFAULT_WEIGHTS)).toBeNull();
  });
});

describe("map light-only score", () => {
  it("keeps the same light score regardless of reports or crime", () => {
    for (const R of [0, .5, 1, 10]) {
      for (const C of [null, 0, 1]) expect(score({ L: .73, R, C }, LIGHT_ONLY_WEIGHTS)).toBe(73);
    }
  });
  it("does not manufacture light for an unmeasured street", () => {
    expect(score({ L: null, R: 0, C: null }, LIGHT_ONLY_WEIGHTS)).toBeNull();
  });
});
