"use client";
// "Last night": the night's totals and the lamped-but-dark streets, straight from the data files.
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadNumbers, type Numbers } from "./numbers";

export function LiveNumbers() {
  const [n, setN] = useState<Numbers | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadNumbers().then(setN, () => setFailed(true)); }, []);

  if (failed) return <p className="secondary">The numbers could not load. The <Link href="/map">map</Link> has them.</p>;

  const stats = n && [
    [n.readings.toLocaleString("en-GB"), "light readings on streets"],
    [String(n.measured), "streets measured"],
    [n.km.toFixed(1), "km walked"],
    [n.predicted.toLocaleString("en-GB"), "streets predicted"],
    [n.lamps.toLocaleString("en-GB"), "council lamp posts checked"],
    [String(n.reports), "“uncomfortable” reports"],
  ];

  return (
    <>
      <div className="ld-numbers" aria-busy={!n}>
        {(stats ?? Array.from({ length: 6 }, () => ["000", "loading"])).map(([value, label], i) => (
          <div key={i} className="ld-number">
            <div className={`data ld-number-value${n ? "" : " lr-skeleton"}`}>{value}</div>
            <div className="ld-number-label">{label}</div>
          </div>
        ))}
      </div>

      {n && n.inspect.length > 0 && (
        <div className="ld-inspect">
          <h3 className="display">Lamped, but dark</h3>
          <p className="secondary">
            These streets have as many council lamp posts as a typical street we walked, yet measure at least
            two stops darker than the streets around them. Each stop is half the light. They are the first places to send an inspector.
          </p>
          <ul>
            {n.inspect.map((s) => (
              <li key={s.name}>
                <span className="ld-inspect-name">{s.name}</span>
                <span className="data ld-inspect-stops">{s.darker.toFixed(1)} stops darker</span>
                {s.lamps.length > 0 && <span className="data ld-inspect-refs">Lamps {s.lamps.join(" · ")}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
