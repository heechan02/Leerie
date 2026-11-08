"use client";

import DetectionFrame from "./DetectionFrame";
import { displayName, isSelectable, priority, severityGrade } from "@/lib/console/derive";
import { coord, hhmm, todayISO } from "@/lib/console/format";
import { SEVERITY_WORD, severityFill, STATUS_VISUAL, whenOf } from "@/lib/console/visual";
import type { Detection, Hazard } from "@/lib/data/types";

/** Uncertainty is stated once, here, and never repeated as a warning. */
const UNCERTAINTY: Record<Hazard["status"], string> = {
  suspected:
    "One scanner only. This is an observation, not a finding. A second scanner must corroborate it before a crew is sent.",
  confirmed: "Corroborated by more than one scanner. Ready to be added to a route.",
  scheduled: "Committed to a crew and carrying a stop order. Remove it from the route to change that.",
  repaired: "Closed. It drops out of the queue at the end of the day.",
  false_positive: "Dismissed as a false positive.",
};

/** The queue never quotes more evidence than an operator will read. */
const MAX_DETECTION_ROWS = 8;

export default function RecordPanel({
  hazard,
  detections,
  onRoute,
  onBack,
  onToggleRoute,
  onDismiss,
}: {
  hazard: Hazard;
  /** `undefined` while the rows are still being fetched. */
  detections: Detection[] | undefined;
  onRoute: boolean;
  onBack: () => void;
  onToggleRoute: () => void;
  onDismiss: () => void;
}) {
  const v = STATUS_VISUAL[hazard.status];
  const grade = severityGrade(hazard.severity);
  // Adding is for work nobody has committed yet; removing has to stay available
  // once a hazard is scheduled, or a stop dropped from a plan is unreachable
  // for the rest of the session.
  const canRoute = isSelectable(hazard) && (onRoute || hazard.status !== "scheduled");
  const today = todayISO();
  const shown = detections?.slice(0, MAX_DETECTION_ROWS) ?? [];
  const more = (detections?.length ?? 0) - shown.length;

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", minHeight: 0, background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)", padding: "var(--s2) var(--s3)", borderBottom: "1px solid var(--rule-soft)" }}>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onBack}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7.5 2.5 4 6l3.5 3.5" />
          </svg>
          Repair queue
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: "var(--s4)", display: "grid", gap: "var(--s4)", alignContent: "start" }}>
        <div>
          <h2 style={{ fontSize: "var(--t-title)", letterSpacing: "-0.015em" }}>{displayName(hazard)}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)", marginTop: "var(--s3)", flexWrap: "wrap" }}>
            <span className={v.tag}>{v.label}</span>
            <span className="data secondary" style={{ fontSize: "var(--t-small)" }}>
              {hazard.ref}
            </span>
          </div>
        </div>

        <DetectionFrame hazard={hazard} />

        <div>
          <h3 className="micro secondary" style={{ marginBottom: "var(--s2)" }}>
            Severity
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s3)" }}>
            <span aria-hidden style={{ display: "flex", gap: 3 }}>
              {[1, 2, 3, 4].map((s) => (
                <i
                  key={s}
                  style={{
                    display: "block",
                    width: 26,
                    height: 6,
                    borderRadius: 1,
                    background: severityFill(grade, s <= grade),
                  }}
                />
              ))}
            </span>
            <span style={{ fontSize: "var(--t-small)", fontWeight: 600 }}>
              {SEVERITY_WORD[grade]}, grade {grade} of 4
            </span>
          </div>
        </div>

        <div>
          <h3 className="micro secondary" style={{ marginBottom: "var(--s2)" }}>
            Evidence
          </h3>
          <dl style={{ margin: 0, display: "grid", gap: 0, border: "1px solid var(--rule-soft)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
            <Fact label="Scanners reporting" value={String(hazard.distinct_scanners)} />
            <Fact label="Passes over location" value={String(hazard.detection_count)} />
            <Fact label="First seen" value={whenOf(hazard.first_detected_at, today)} />
            <Fact label="Last seen" value={whenOf(hazard.last_detected_at, today)} />
            <Fact label="Coordinates" value={coord(hazard.lat, hazard.lng)} />
            <Fact label="Queue priority" value={priority(hazard).toFixed(1)} last />
          </dl>
          <p className="secondary" style={{ margin: "var(--s2) 0 0", fontSize: "var(--t-small)", lineHeight: 1.45 }}>
            {UNCERTAINTY[hazard.status]}
          </p>
        </div>

        <div>
          <h3 className="micro secondary" style={{ marginBottom: "var(--s2)" }}>
            Detections
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-small)" }}>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Scanner</Th>
                <Th align="right">Severity</Th>
                <Th align="right">Speed</Th>
              </tr>
            </thead>
            <tbody>
              {detections === undefined && (
                <tr>
                  <td colSpan={4} style={CELL}>
                    <span aria-hidden style={{ display: "block", height: 14, background: "var(--canvas)", borderRadius: "var(--r-sm)" }} />
                  </td>
                </tr>
              )}
              {detections !== undefined && detections.length === 0 && (
                <tr>
                  <td colSpan={4} className="secondary" style={CELL}>
                    No detections recorded.
                  </td>
                </tr>
              )}
              {shown.map((d) => (
                <tr key={d.id}>
                  <td className="data" style={CELL}>{hhmm(d.recorded_at)}</td>
                  <td style={CELL}>{d.scanner_label ?? d.scanner_id.slice(0, 8)}</td>
                  <td className="data" style={{ ...CELL, textAlign: "right" }}>{d.severity.toFixed(2)}</td>
                  <td className="data" style={{ ...CELL, textAlign: "right" }}>
                    {d.speed_mps == null ? "—" : `${(d.speed_mps * 3.6).toFixed(0)} km/h`}
                  </td>
                </tr>
              ))}
              {more > 0 && (
                <tr>
                  <td colSpan={4} className="secondary" style={CELL}>
                    and {more} more
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gap: "var(--s2)", padding: "var(--s3) var(--s4)", borderTop: "1px solid var(--rule)", background: "var(--canvas)" }}>
        {canRoute ? (
          <button
            type="button"
            className={onRoute ? "btn btn-secondary" : "btn btn-primary"}
            onClick={onToggleRoute}
            style={{ width: "100%" }}
          >
            {onRoute ? "Remove from route" : "Add to route"}
          </button>
        ) : (
          <p className="secondary" style={{ margin: 0, fontSize: "var(--t-small)" }}>
            {hazard.status === "scheduled"
              ? `On a crew route as stop ${hazard.stop_order ?? "—"}.`
              : "Closed. No action available."}
          </p>
        )}
        <button type="button" className="btn btn-quiet btn-sm" onClick={onDismiss} style={{ width: "100%" }}>
          Dismiss as false positive
        </button>
      </div>
    </div>
  );
}

const CELL: React.CSSProperties = {
  padding: "5px var(--s2)",
  borderBottom: "1px solid var(--rule-soft)",
  textAlign: "left",
};

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className="micro secondary"
      scope="col"
      style={{ ...CELL, textAlign: align ?? "left", borderBottom: "1px solid var(--rule)", fontWeight: 600 }}
    >
      {children}
    </th>
  );
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--s3)",
        padding: "7px var(--s3)",
        borderBottom: last ? "none" : "1px solid var(--rule-soft)",
      }}
    >
      <dt className="secondary" style={{ fontSize: "var(--t-small)" }}>
        {label}
      </dt>
      <dd className="data" style={{ margin: 0, fontSize: "var(--t-small)", fontWeight: 500, textAlign: "right" }}>
        {value}
      </dd>
    </div>
  );
}
