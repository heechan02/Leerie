// Score with the council's own weights. The brief's default is 0.5 / 0.3 / 0.2.
export type Weights = { L: number; R: number; C: number };
export const DEFAULT_WEIGHTS: Weights = { L: 0.5, R: 0.3, C: 0.2 };

/** 0–100. Weights are normalised so the sliders never need to add up to 1. */
export function score(p: { L: number; R: number; C: number | null }, w: Weights): number {
  const total = w.L + w.R + w.C;
  if (total <= 0) return 0;
  // Unknown area crime counts as the middle, not as safe or unsafe.
  const c = p.C ?? 0.5;
  return (100 * (w.L * p.L + w.R * (1 - p.R) + w.C * (1 - c))) / total;
}
