// The hovered street's breakdown, floating beside the cursor on the map.
import { score, LIGHT_ONLY_WEIGHTS } from "./score";
import type { SegmentProps } from "./types";

const CARD_W = 320;
const CARD_H = 360; // rough height, only used to keep the card on screen
const GAP = 16;

const stops = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`);

type Props = { street: SegmentProps; x: number; y: number; width: number; height: number; lightRadius?: number };

export function HoverCard({ street, x, y, width, height, lightRadius }: Props) {
  const s = score(street, LIGHT_ONLY_WEIGHTS);
  // Flip to the left of the cursor near the right edge; clamp vertically.
  const left = x + GAP + CARD_W > width ? Math.max(8, x - GAP - CARD_W) : x + GAP;
  const top = Math.min(Math.max(8, y - CARD_H / 2), Math.max(8, height - CARD_H - 8));


  return (
    <div className="lr-card lr-glass lr-hover" style={{ left, top }}>
      <div className="lr-hover-head">
        <div>
          <div className="lr-hover-name">{street.name ?? "Unnamed street"}</div>
          <div className="micro secondary">{street.highway}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="data lr-score">{s == null ? "—" : s.toFixed(0)}</div>
          <div className="micro secondary">{lightRadius ? "local light" : "light"} / 100</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s1)", marginTop: "var(--s2)" }}>
        {street.measured ? (
          <span className="lr-pill lr-pill-measured">MEASURED · {street.passes} {street.passes === 1 ? "pass" : "passes"} · {street.n_readings} readings</span>
        ) : (
          <span className="lr-pill">{street.L == null ? "NOT WALKED · NO ESTIMATE YET" : "PREDICTED FROM NEIGHBOURS"}</span>
        )}
        {street.measured && lightRadius && s == null && <span className="lr-pill">NO NEARBY COMPARISON</span>}
        {street.inspect && <span className="lr-pill lr-pill-warn">LAMPED BUT DARKER THAN EXPECTED</span>}
      </div>

      <div className="lr-bars">
        <div className="lr-bar-row">
          <span>{lightRadius ? "Local light percentile" : "Relative light percentile"}</span>
          <span className="data secondary">{s == null ? "unknown" : `${s.toFixed(0)} / 100`}</span>
          <div className="lr-bar lr-bar-light"><span style={{ width: `${s ?? 0}%` }} /></div>
        </div>
      </div>
      <p className="lr-line">Reports <span className="data">{(street.reports_possible ?? 0) + (street.reports_confirmed ?? 0)}</span>
        <span className="secondary"> · <span className="data">{street.reports_confirmed ?? 0}</span> confirmed hotspots</span>
      </p>

      <p className="lr-line">
        Light <span className="data">{stops(street.brightness_stops)}</span> stops
        <span className="secondary"> (80%: <span className="data">{stops(street.brightness_lo)} to {stops(street.brightness_hi)}</span>)</span>
      </p>
      <p className="lr-line secondary" style={{ fontSize: "var(--t-micro)" }}>
        {lightRadius ? `vs local median within ${lightRadius} m` : "vs median street"} · +1 = 2× light
      </p>
      {street.nearest_lamp_m != null && (
        <p className="lr-line">
          Council lamps <span className="data">{(street.lamps_per_100m ?? 0).toFixed(1)}</span> per 100 m
          <span className="secondary"> · nearest <span className="data">{Math.round(street.nearest_lamp_m)} m</span></span>
        </p>
      )}
    </div>
  );
}
