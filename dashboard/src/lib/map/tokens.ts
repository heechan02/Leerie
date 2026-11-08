/**
 * The basemap is the one place the design system has to leave CSS behind:
 * MapLibre paints in a WebGL canvas, so it cannot read a custom property and
 * cannot resolve `color-mix`. Every colour it needs is therefore read out of
 * `:root` once and handed over as a literal.
 *
 * This file is the only place in the app allowed to name a hex, and each one
 * is a copy of the token beside it in `globals.css`, kept for the server
 * render and for tests, where there is no document to read from.
 */
export const MAP_FALLBACK = {
  canvas: "#f3f2f1",
  ink: "#0b0c0c",
  action: "#1d70b8",
  committed: "#00703c",
  ruleSoft: "#e4e2e0",
} as const;

/** Leerie's night map: dusk ground, streets ramp from violet (low score) to sodium amber (high). */
export const NIGHT = {
  ground: "#0b0d1a", // --night
  ink: "#ece8f4", // --ink
  water: "#15172e", // --dusk
  dim: "#3a3766", // a step above --dusk-3, so dark streets still show
  mid: "#a9a6c4", // --ink-2
  lit: "#ffd27a", // --amber-hot
  lamp: "#f5b54a", // --amber
  hotLow: "#ff7a5c", // --hot-low
  hotHigh: "#c2185b", // --hot-high
  picked: "#ffffff", // Light first: white-hot, off the score ramp
  scan: "#b9a8ff", // Scan next: lavender, off the score ramp
} as const;

export interface MapTokens {
  /** Ground under everything. `--canvas`. */
  ground: string;
  /** Roads and their labels, at low opacity. `--ink`. */
  ink: string;
  /** Work proposed: the route line, the drawn area, the fleet trails. `--action`. */
  action: string;
  /** Work committed to a crew: the stop badges. `--committed`. */
  committed: string;
  /** Water, a hairline lighter than the ground. `--rule-soft`. */
  water: string;
}

/** Read a CSS custom property from `:root`, falling back off the browser. */
export function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function readMapTokens(): MapTokens {
  return {
    ground: readToken("--canvas", MAP_FALLBACK.canvas),
    ink: readToken("--ink", MAP_FALLBACK.ink),
    action: readToken("--action", MAP_FALLBACK.action),
    committed: readToken("--committed", MAP_FALLBACK.committed),
    water: readToken("--rule-soft", MAP_FALLBACK.ruleSoft),
  };
}
