// The hovered street's breakdown, floating beside the cursor on the map.
import { score, type Weights } from "./score";
import type { SegmentProps } from "./types";

const CARD_W = 320;
const CARD_H = 330; // rough height, only used to keep the card on screen
const GAP = 16;

const stops = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`);

type Props = { street: SegmentProps; weights: Weights; x: number; y: number; width: number; height: number };

export function HoverCard({ street, weights, x, y, width, height }: Props) {
  const s = score(street, weights);
  const total = weights.L + weights.R + weights.C || 1;
  // Flip to the left of the cursor near the right edge; clamp vertically.
  const left = x + GAP + CARD_W > width ? Math.max(8, x - GAP - CARD_W) : x + GAP;
  const top = Math.min(Math.max(8, y - CARD_H / 2), Math.max(8, height - CARD_H - 8));
  const bars = [
    { key: "L", label: "Light", value: street.L, weight: weights.L, light: true },
    { key: "R", label: "Few reports (1 − R)", value: 1 - street.R, weight: weights.R },
    { key: "C", label: street.C == null ? "Area crime unknown" : "Low area crime (1 − C)", value: 1 - (street.C ?? 0.5), weight: weights.C },
  ];

  return (
    <div className="lr-card lr-hover" style={{ left, top }}>
      <div className="lr-hover-head">
        <div>
          <div className="lr-hover-name">{street.name ?? "Unnamed street"}</div>
          <div className="micro secondary">{street.highway}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="data lr-score">{s == null ? "—" : s.toFixed(0)}</div>
          <div className="micro secondary">score / 100</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s1)", marginTop: "var(--s2)" }}>
        {street.measured ? (
          <span className="lr-pill lr-pill-measured">MEASURED · {street.passes} {street.passes === 1 ? "pass" : "passes"} · {street.n_readings} readings</span>
        ) : (
          <span className="lr-pill">{street.L == null ? "NOT WALKED · NO ESTIMATE YET" : "PREDICTED FROM NEIGHBOURS"}</span>
        )}
        {street.inspect && <span className="lr-pill lr-pill-warn">LAMPED BUT DARKER THAN EXPECTED</span>}
      </div>

      <div className="lr-bars">
        {bars.map((b) => (
          <div key={b.key} className="lr-bar-row">
            <span>{b.label}</span>
            <span className="data secondary">{b.value == null ? "unknown" : b.value.toFixed(2)} × {(b.weight / total).toFixed(2)}</span>
            <div className={`lr-bar${b.light ? " lr-bar-light" : ""}`}>
              <span style={{ width: `${(b.value ?? 0) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="lr-line">
        Light <span className="data">{stops(street.brightness_stops)}</span> stops
        <span className="secondary"> (80%: <span className="data">{stops(street.brightness_lo)} to {stops(street.brightness_hi)}</span>)</span>
      </p>
      <p className="lr-line secondary" style={{ fontSize: "var(--t-micro)" }}>vs median street · +1 = 2× light</p>
    </div>
  );
}
