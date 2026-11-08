// The score weights: our choice, so the viewer can change them.
import { DEFAULT_WEIGHTS, type Weights } from "./score";

const LABELS = { L: "Light", R: "Reports", C: "Area crime" } as const;

export function WeightSliders({ weights, onChange }: { weights: Weights; onChange: (w: Weights) => void }) {
  return (
    <section aria-labelledby="weights-h">
      <h2 id="weights-h" className="micro">Score weights · our choice</h2>
      <div className="lr-weights">
        {(["L", "R", "C"] as const).map((k) => (
          <label key={k} className="lr-weight">
            {LABELS[k]}
            <input className="lr-range" type="range" min={0} max={1} step={0.05} value={weights[k]}
              aria-valuetext={weights[k].toFixed(2)}
              onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })} />
            <output className="data">{weights[k].toFixed(2)}</output>
          </label>
        ))}
        <button type="button" className="lr-link" onClick={() => onChange(DEFAULT_WEIGHTS)}>
          Reset
        </button>
      </div>
    </section>
  );
}
