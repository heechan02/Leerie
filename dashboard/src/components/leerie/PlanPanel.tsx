// Plan mode: the council draws a box, enters its own budget, cost per light and spacing,
// and gets the streets to light, a works order to send contractors, Scan next and Inspect first.
import type { Plan } from "@/lib/leerie/planner";

export type PlanInputs = { budget: string; costPerLight: string; spacingM: string };

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const gbpShort = (n: number) => (n >= 10_000 ? `£${Math.round(n / 1000)}k` : gbp(n));
const csvCell = (v: string | number | null) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function downloadWorksOrder(plan: Plan, inputs: PlanInputs) {
  const rows = [
    ["Street", "Segment", "Lights", "Cost (GBP)", "Score gain"],
    ...plan.picks.map((p) => [p.name ?? "Unnamed", p.segment_id, p.lights, p.cost, p.gain.toFixed(1)]),
    [],
    ["Total", "", plan.picks.reduce((s, p) => s + p.lights, 0), plan.spend, ""],
    ["Cost per light (GBP)", inputs.costPerLight], ["Spacing (m)", inputs.spacingM], ["Budget (GBP)", inputs.budget],
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "leerie-works-order.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function PlanPanel({ plan, hasBox, inputs, onInputs, onClearBox }: {
  plan: Plan | null; hasBox: boolean; inputs: PlanInputs;
  onInputs: (i: PlanInputs) => void; onClearBox: () => void;
}) {
  const field = (key: keyof PlanInputs, label: string) => (
    <label className="lr-field">
      {label}
      <input className="data" type="number" min={0} inputMode="decimal" value={inputs[key]}
        onChange={(e) => onInputs({ ...inputs, [key]: e.target.value })} />
    </label>
  );

  return (
    <section className="lr-plan" aria-labelledby="plan-h">
      <h2 id="plan-h" className="micro">Area</h2>
      {hasBox
        ? <button type="button" className="lr-link" onClick={onClearBox}>Clear box</button>
        : <p className="secondary lr-hint">Drag on the map to draw a box.</p>}

      <div className="lr-fields">
        {field("budget", "Budget (£)")}
        {field("costPerLight", "Cost per light (£)")}
        {field("spacingM", "Light spacing (m)")}
      </div>

      {plan && (
        <>
          <div className="lr-stats">
            <Stat value={String(plan.picks.length)} label="streets" />
            <Stat value={gbpShort(plan.spend)} label="spend" />
            <Stat value={plan.scoreBefore == null || plan.scoreAfter == null ? "—"
              : `+${(plan.scoreAfter - plan.scoreBefore).toFixed(1)}`} label="area score" />
          </div>

          <h2 className="micro">Light first</h2>
          {plan.picks.length === 0 ? <p className="secondary lr-hint">Nothing fits this budget.</p> : (
            <ol className="lr-list">
              {plan.picks.map((p) => (
                <li key={p.segment_id}>
                  <span>{p.name ?? "Unnamed"}</span>
                  <span className="data secondary">{p.lights} × · {gbp(p.cost)}</span>
                </li>
              ))}
            </ol>
          )}
          <button type="button" className="lr-button" disabled={plan.picks.length === 0}
            onClick={() => downloadWorksOrder(plan, inputs)}>
            Download works order (CSV)
          </button>

          <h2 className="micro">Scan next</h2>
          {plan.scanNext.length === 0 ? <p className="secondary lr-hint">No uncertain predicted streets here.</p> : (
            <ol className="lr-list">
              {plan.scanNext.map((s) => (
                <li key={s.segment_id}>
                  <span>{s.name ?? "Unnamed"}</span>
                  <span className="data secondary">{Math.round(s.pDark * 100)}% dark</span>
                </li>
              ))}
            </ol>
          )}

          {plan.inspect.length > 0 && (
            <>
              <h2 className="micro">Inspect first</h2>
              <ul className="lr-list">{plan.inspect.map((s) => <li key={s.segment_id}>{s.name ?? "Unnamed"}</li>)}</ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="lr-stat">
      <div className="data lr-stat-value">{value}</div>
      <div className="lr-stat-label">{label}</div>
    </div>
  );
}
