import Link from "next/link";
import type { NightJourney } from "@/lib/leerie/replay";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

export function ReplayStory({ journey, km, activeTrails, hidden }: {
  journey: NightJourney; km: number; activeTrails: number; hidden?: boolean;
}) {
  const cycled = (journey.selection?.date ?? journey.date) === "2026-11-08";
  const date = dateFormat.format(journey.start * 1000);
  return (
    <aside className="replay-story lr-glass" style={{ visibility: hidden ? "hidden" : undefined }}>
      <span className="micro replay-eyebrow">{date} · {journey.unfiltered ? "All GPS fixes" : "GPS filtered"}</span>
      <Link className="replay-view-link" href={journey.unfiltered ? "/replay" : "/replay?view=raw"}>
        {journey.unfiltered ? "View GPS filtered replay ↗" : "View all selected GPS fixes ↗"}
      </Link>
      <h1 className={`display ${journey.unfiltered ? "replay-raw-title" : ""}`}>
        {journey.unfiltered ? <>Every point.<br />Selected times.</> : cycled ? <>A night<br />by bike.</> : <>A night<br />survey.</>}
      </h1>
      {cycled && <p className="replay-survey-note">We cycled this survey, which explains the higher recorded speeds. With limited time, we needed to collect as much data as possible as quickly as we could.</p>}
      <div className="replay-rule" />
      <div className="replay-metrics">
        <div><strong className="data">{km.toFixed(1)}<small> km</small></strong><span>combined trails · approx.</span></div>
        <div><strong className="data">{activeTrails.toString().padStart(2, "0")}</strong><span>active recording trails</span></div>
      </div>
      <p className="replay-caption">{journey.unfiltered ? "All GPS fixes in the three selected windows, including drift and jumps. Trails stay separate across excluded times." : "Amber traces the recorded routes. White lights mark the latest positions."}</p>
      {journey.selection && <details className="replay-window-details"><summary>3 selected windows · GMT</summary><p>{journey.selection.windows.map(([start, end]) => <span key={start} style={{ display: "block" }} className="data">{start}–{end}</span>)}</p></details>}
      <details>
        <summary>About this recording</summary>
        {cycled && <p>Leerie is designed for walking surveys.</p>}
        <p>{journey.readings.toLocaleString("en-GB")} {journey.unfiltered ? "selected, GPS-unfiltered" : "selected night"} readings across {journey.sessions} recording sessions. {journey.note} Distances sum all recording trails, including repeat passes and devices travelling together. Source: Supabase light readings. All times GMT.</p>
      </details>
    </aside>
  );
}
