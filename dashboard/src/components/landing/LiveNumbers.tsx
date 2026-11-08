"use client";

import Link from "next/link";
import { useSurveyNumbers } from "./SurveyNumbers";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export function LiveNumbers() {
  const { numbers: n, failed } = useSurveyNumbers();
  const surveyDate = n?.selection?.date;
  const stats = n && [
    [n.readings.toLocaleString("en-GB"), "light readings on measured segments"],
    [n.measured.toLocaleString("en-GB"), "street segments measured"],
    [n.km.toFixed(1), "km of measured streets"],
    [n.predicted.toLocaleString("en-GB"), "street segments estimated"],
    [n.lamps.toLocaleString("en-GB"), "council lamp posts on the map"],
    [n.reports.toLocaleString("en-GB"), "mapped “uncomfortable” reports"],
  ];

  return (
    <>
      <p className="micro ld-eyebrow">Night survey{surveyDate && ` · ${dateFormat.format(new Date(surveyDate))}`}</p>
      <h2 className="display ld-h2">One night mapping Edinburgh.</h2>
      {surveyDate === "2026-11-08" && <p className="ld-shifts secondary">We surveyed by bike in three recording windows, from Princes Street to Liberton.</p>}
      {failed ? <p className="secondary" role="status">Survey statistics are temporarily unavailable.</p> : (
        <div className="ld-numbers" aria-busy={!n}>
          {(stats ?? Array.from({ length: 6 }, () => ["000", "loading"])).map(([value, label], i) => (
            <div key={i} className="ld-number">
              <div className={`data ld-number-value${n ? "" : " lr-skeleton"}`}>{value}</div>
              <div className="ld-number-label">{label}</div>
            </div>
          ))}
        </div>
      )}
      {n && <p className="ld-survey-detail secondary">
        The map includes {n.network.toLocaleString("en-GB")} street segments. {n.confirmed.toLocaleString("en-GB")} segments had reports from at least two recording sessions.
      </p>}

      {n && n.inspect.length > 0 && (
        <div className="ld-inspect">
          <h3 className="display">Lamped, but dark</h3>
          <p className="secondary">
            These streets have at least the typical density of council lamp posts and measure two or more stops below their neighbours.
          </p>
          <ul>
            {n.inspect.map((s) => (
              <li key={s.id}>
                <span className="ld-inspect-name">{s.name}</span>
                <span className="data ld-inspect-stops">{s.darker.toFixed(1)} stops darker</span>
                {s.lamps.length > 0 && <span className="data ld-inspect-refs">Lamps {s.lamps.join(" · ")}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link className="lr-button" href="/map">Explore the map</Link>
    </>
  );
}
