// Plan mode: review proposed lamp sites, their cost and where to inspect or measure next.
import { HOTSPOT_MIN_POSTS, PLAN_DEFAULTS, type LightingHotspot, type Plan } from "@/lib/leerie/planner";

export type PlanInputs = { budget: string; costPerLight: string; spacingM: string };

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const gbpShort = (n: number) => (n >= 10_000 ? `£${Math.round(n / 1000)}k` : gbp(n));
const csvCell = (v: string | number | null) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function downloadWorksOrder(plan: Plan, inputs: PlanInputs) {
  const rows = [
    ["Street", "Segment", "Lights", "Cost (GBP)", "Score gain"],
    ...plan.picks.map((p) => [p.name ?? "Unnamed", p.segment_id, p.lights, p.cost, p.gain.toFixed(1)]),
    [],
    ["Total", "", plan.lamps.length, plan.spend, ""],
    ["Cost per light (GBP)", inputs.costPerLight], ["Spacing (m)", inputs.spacingM], ["Budget (GBP)", inputs.budget],
    [],
    ["Proposed lamp", "Street", "Segment", "Latitude", "Longitude"],
    ...plan.lamps.map(({ name, segment_id, coordinates: [lng, lat] }, i) =>
      [i + 1, name ?? "Unnamed", segment_id, lat.toFixed(7), lng.toFixed(7)]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "leerie-works-order.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function PlanPanel({ plan, hasBox, inputs, onInputs, onClearBox, lampError, showLightingHotspots, onShowLightingHotspots, hotspots }: {
  plan: Plan | null; hasBox: boolean; inputs: PlanInputs; lampError: boolean;
  onInputs: (i: PlanInputs) => void; onClearBox: () => void;
  showLightingHotspots: boolean; onShowLightingHotspots: (show: boolean) => void; hotspots: LightingHotspot[] | null;
}) {
  const field = (key: keyof PlanInputs, label: string) => (
    <label className="lr-field">
      {label}
      <input className="data" type="number" min={key === "spacingM" ? 1 : 0.01} step="any" inputMode="decimal" value={inputs[key]}
        onChange={(e) => onInputs({ ...inputs, [key]: e.target.value })} />
    </label>
  );

  return (
    <section className="lr-plan" aria-labelledby="plan-h">
      <h2 id="plan-h" className="micro">Area</h2>
      {hasBox
        ? <button type="button" className="lr-link" onClick={onClearBox}>Clear box</button>
        : <p className="secondary lr-hint">Drag on the map to draw a box.</p>}

      <label className="lr-toggle lr-lighting-hotspot-toggle secondary">
        <input type="checkbox" checked={showLightingHotspots} onChange={(e) => onShowLightingHotspots(e.target.checked)} />
        Show lighting hotspots
      </label>
      {showLightingHotspots && (
        <div className="lr-hint">
          <span>{HOTSPOT_MIN_POSTS}+ proposed posts in the map-wide {gbpShort(PLAN_DEFAULTS.budget)} plan.</span>
          {hotspots == null ? <p className="lr-hint" role="status">Loading lighting hotspots…</p>
            : hotspots.length === 0 ? <p className="lr-hint">No streets meet this threshold.</p> : (
              <details>
                <summary>{hotspots.length} hotspot streets and paths</summary>
                <ol className="lr-list">
                  {hotspots.map(({ name, lights, segmentIds }) => (
                    <li key={segmentIds[0]}><div><span>{name ?? "Unnamed segment"}</span><span className="data">{lights} posts</span></div></li>
                  ))}
                </ol>
              </details>
            )}
        </div>
      )}

      <div className="lr-fields">
        {field("budget", "Budget (£)")}
        {field("costPerLight", "Cost per lamp post (£)")}
        {field("spacingM", "Lamp spacing (m)")}
      </div>
      {lampError && <p className="lr-warn" role="status">Council lamp records are unavailable. Check for existing posts at the proposed sites.</p>}

      {plan && (
        <>
          <div className="lr-stats">
            <Stat value={String(plan.lamps.length)} label="proposed lamps" />
            <Stat value={gbpShort(plan.spend)} label="spend" />
            <Stat value={plan.scoreBefore == null || plan.scoreAfter == null ? "—"
              : `+${(plan.scoreAfter - plan.scoreBefore).toFixed(1)}`} label="estimated score gain" />
          </div>

          <h2 className="micro">Light first</h2>
          {plan.picks.length === 0 ? <p className="secondary lr-hint">No eligible lamp sites fit this area and budget.</p> : (
            <ol className="lr-list">
              {plan.picks.map((p) => (
                <li key={p.segment_id}><div>
                  <span>{p.name ?? "Unnamed"}</span>
                  <span className="data secondary">{p.lights} {p.lights === 1 ? "lamp" : "lamps"} · {gbp(p.cost)}</span>
                </div></li>
              ))}
            </ol>
          )}
          {plan.lamps.length > 0 && <p className="lr-hint">White dots mark suggested sites along the street. Check exact placement on site.</p>}
          <button type="button" className="lr-button" style={{ width: "100%" }} disabled={plan.picks.length === 0}
            onClick={() => downloadWorksOrder(plan, inputs)}>
            Download works order (CSV)
          </button>

          <h2 className="micro">Scan next</h2>
          {plan.scanNext.length === 0 ? <p className="secondary lr-hint">No uncertain predicted streets here.</p> : (
            <ol className="lr-list">
              {plan.scanNext.map((s) => (
                <li key={s.segment_id}><div>
                  <span>{s.name ?? "Unnamed"}</span>
                  <span className="data secondary">{Math.round(s.pDark * 100)}% likely dark</span>
                </div></li>
              ))}
            </ol>
          )}

          {plan.inspect.length > 0 && (
            <>
              <h2 className="micro">Inspect first · lamped but dark</h2>
              <ul className="lr-list">
                {plan.inspect.map((s) => (
                  <li key={s.segment_id}>
                    {s.name ?? "Unnamed"}
                    {s.lamp_refs.length > 0 && <span className="lr-refs data">Lamps {s.lamp_refs.join(", ")}</span>}
                  </li>
                ))}
              </ul>
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
