import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { NightReplay } from "@/components/leerie/NightReplay";
import type { NightJourney, ReplayDiagnostics } from "@/lib/leerie/replay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leerie · Night replay" };

export default async function ReplayPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const raw = (await searchParams).view === "raw";
  let journey: NightJourney;
  try {
    journey = JSON.parse(await readFile(path.join(process.cwd(), "..", raw ? ".env.replay.raw.json" : ".env.replay.json"), "utf8"));
  } catch {
    return <main style={{ padding: 48 }}><h1 className="display">No night replay yet</h1><p>Export a night with <code>python3 -m pipeline.replay YYYY-MM-DD</code> from the project root.</p><Link href="/map">Back to the map</Link></main>;
  }
  if (process.env.NODE_ENV === "development") {
    const { LocalNightReplay } = await import("@/components/leerie/LocalNightReplay");
    let diagnostics: ReplayDiagnostics | undefined;
    try { diagnostics = JSON.parse(await readFile(path.join(process.cwd(), "..", ".env.replay.debug.json"), "utf8")); } catch { /* Export diagnostics locally when needed. */ }
    return <LocalNightReplay key={raw ? "raw" : "filtered"} journey={journey} diagnostics={diagnostics} />;
  }
  return <NightReplay key={raw ? "raw" : "filtered"} journey={journey} />;
}
