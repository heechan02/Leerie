// Score with the council's own weights. The brief's default is 0.5 / 0.3 / 0.2.
export type Weights = { L: number; R: number; C: number };
export const LIGHT_ONLY_WEIGHTS: Weights = { L: 1, R: 0, C: 0 };
export const DEFAULT_WEIGHTS: Weights = { L: 0.5, R: 0.3, C: 0.2 };

/** 0–100, or null when the street has no light estimate. Weights are normalised. */
export function score(p: { L: number | null; R: number; C: number | null }, w: Weights): number | null {
  const total = w.L + w.R + w.C;
  if (p.L == null || total <= 0) return null;
  // Unknown area crime counts as the middle, not as safe or unsafe.
  const c = p.C ?? 0.5;
  return (100 * (w.L * p.L + w.R * (1 - p.R) + w.C * (1 - c))) / total;
}
