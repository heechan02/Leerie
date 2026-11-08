// Compact map key, bottom-left over the map.
import { NIGHT } from "@/lib/map/tokens";

export function Legend() {
  return (
    <div className="lr-card lr-legend" aria-label="Map legend">
      <div className="micro secondary">Score</div>
      <div className="lr-ramp" style={{ background: `linear-gradient(90deg, ${NIGHT.dim}, ${NIGHT.mid}, ${NIGHT.lit})` }} />
      <div className="lr-ticks data"><span>0 darker</span><span>50</span><span>100 lighter</span></div>
      <div className="lr-key"><i /> Measured</div>
      <div className="lr-key"><i style={{ opacity: 0.4, height: 3 }} /> Predicted</div>
      <div className="lr-key">
        <b className="lr-dot" style={{ background: `linear-gradient(90deg, #f08a24, #b3121f)` }} aria-hidden /> Reports, 2+ walks
      </div>
      <div className="secondary" style={{ fontSize: "var(--t-micro)", marginTop: "var(--s2)" }}>Relative light, not lux.</div>
    </div>
  );
}
