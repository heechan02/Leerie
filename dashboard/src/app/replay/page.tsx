import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { NightReplay } from "@/components/leerie/NightReplay";
import type { NightJourney } from "@/lib/leerie/replay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leerie · A night on foot" };

export default async function ReplayPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const raw = (await searchParams).view === "raw";
  let journey: NightJourney;
  try {
    journey = JSON.parse(await readFile(path.join(process.cwd(), "..", raw ? ".env.replay.raw.json" : ".env.replay.json"), "utf8"));
  } catch {
    return <main style={{ padding: 48 }}><h1 className="display">No night replay yet</h1><p>Export a night with <code>python3 -m pipeline.replay YYYY-MM-DD</code> from the project root.</p><Link href="/map">Back to the map</Link></main>;
  }
  return <NightReplay key={raw ? "raw" : "filtered"} journey={journey} />;
}
