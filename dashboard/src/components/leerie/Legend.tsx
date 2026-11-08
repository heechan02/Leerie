// Compact map key, bottom-left over the map.
import { NIGHT } from "@/lib/map/tokens";

export function Legend({ mode, layer }: { mode: "map" | "plan"; layer: "light" | "lamps" }) {
  return (
    <div className="lr-card lr-glass lr-legend" aria-label="Map legend">
      {layer === "light" ? (
        <>
          <div className="micro secondary">Score</div>
          <div className="lr-ramp" style={{ background: `linear-gradient(90deg, ${NIGHT.dim}, ${NIGHT.mid}, ${NIGHT.lit})` }} />
          <div className="lr-ticks data"><span>0 darker</span><span>50</span><span>100 lighter</span></div>
          <div className="lr-key"><i /> Measured</div>
          <div className="lr-key"><i style={{ opacity: 0.4, height: 3 }} /> Predicted</div>
        </>
      ) : (
        <div className="lr-key"><b className="lr-lampdot" aria-hidden /> Council lamp post</div>
      )}
      <div className="lr-key">
        <b className="lr-dot" style={{ background: `linear-gradient(90deg, ${NIGHT.hotLow}, ${NIGHT.hotHigh})` }} aria-hidden /> Reports, 2+ walks
      </div>
      {mode === "plan" && (
        <>
          <div className="lr-key"><i style={{ background: NIGHT.picked, boxShadow: `0 0 8px ${NIGHT.lamp}` }} /> Light first</div>
          <div className="lr-key"><i style={{ background: `repeating-linear-gradient(90deg, ${NIGHT.scan} 0 4px, transparent 4px 9px)` }} /> Scan next</div>
        </>
      )}
      <div className="secondary" style={{ fontSize: 11, marginTop: "var(--s2)" }}>Relative light, not lux.</div>
    </div>
  );
}
