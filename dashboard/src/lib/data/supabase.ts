import type { SupabaseClient } from "@supabase/supabase-js";
import type { Crew, HazardMapRow, ScannerPositionRow } from "@/lib/types";
import type { ConsoleDataSource, Detection, DispatchResult, LoadResult, Scanner } from "./types";
import { toHazard, toScanner } from "./types";

export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { msg = ((await res.json()) as { error?: string }).error ?? msg; } catch { /* keep status */ }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// Note: `client` has no default here (unlike the brief's literal signature) because a
// default value referencing the real `supabase` binding would force a static top-level
// `import { supabase } from "@/lib/supabase"`, which throws at *module load* time when
// NEXT_PUBLIC_SUPABASE_URL is unset (see src/lib/supabase.ts) — breaking any bare import
// of this module, including the test file's own top-level import. createDataSource() in
// ./index.ts resolves and passes the real client explicitly, only when configured.
export function createSupabaseSource(client: SupabaseClient): ConsoleDataSource {
  const hazardRow = async (id: string): Promise<HazardMapRow | null> => {
    const { data } = await client.from("hazards_map").select("*").eq("id", id);
    return (data?.[0] as HazardMapRow | undefined) ?? null;
  };
  const stopOrders = async (): Promise<Map<string, number>> => {
    const { data } = await client.from("work_orders").select("hazard_id, stop_order").in("status", ["assigned", "in_progress"]);
    return new Map((data ?? []).map((w: { hazard_id: string; stop_order: number | null }) => [w.hazard_id, w.stop_order ?? 0]));
  };

  return {
    async load(): Promise<LoadResult> {
      const [ph, vp, cr, tr, so] = await Promise.all([
        client.from("hazards_map").select("*")
          .or(`status.in.(suspected,confirmed,scheduled),and(status.eq.repaired,repaired_at.gte.${startOfTodayISO()})`),
        client.from("latest_scanner_positions").select("*"),
        client.from("crews").select("*"),
        client.from("trips").select("distance_m").gte("started_at", startOfTodayISO()),
        stopOrders(),
      ]);
      if (ph.error) throw new Error(ph.error.message);
      if (vp.error) throw new Error(vp.error.message);
      if (cr.error) throw new Error(cr.error.message);
      const hazards = ((ph.data ?? []) as HazardMapRow[]).map((r) => toHazard(r, so.get(r.id) ?? null));
      const scanners: Scanner[] = ((vp.data ?? []) as ScannerPositionRow[]).map(toScanner);
      const crews = (cr.data ?? []) as Crew[];
      // Trips are informational (the km-today tile); a failed query falls back to 0 rather
      // than failing the whole load.
      const kmToday = tr.error ? 0 :
        ((tr.data ?? []) as { distance_m: number | null }[]).reduce((s, t) => s + (t.distance_m ?? 0), 0) / 1000;
      return { hazards, scanners, crews, kmToday };
    },

    subscribe({ onHazard, onScanner }) {
      const channel = client.channel("map")
        .on("postgres_changes", { event: "*", schema: "public", table: "hazards" }, async (payload) => {
          if (payload.eventType === "DELETE") { onHazard({ id: (payload.old as { id: string }).id, deleted: true }); return; }
          const id = (payload.new as { id: string }).id;
          const [row, so] = await Promise.all([hazardRow(id), stopOrders()]);
          if (row) onHazard(toHazard(row, so.get(id) ?? null));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "scanner_positions" }, async (payload) => {
          const vid = (payload.new as { scanner_id: string }).scanner_id;
          const { data } = await client.from("latest_scanner_positions").select("*").eq("scanner_id", vid);
          const row = data?.[0] as ScannerPositionRow | undefined;
          if (row) onScanner(toScanner(row));
        })
        .subscribe();
      return () => { void client.removeChannel(channel); };
    },

    async detections(hazardId): Promise<Detection[]> {
      const { data, error } = await client.from("detections")
        .select("id, hazard_id, scanner_id, recorded_at, severity, speed_mps, photo_url, scanner:scanners(label)")
        .eq("hazard_id", hazardId).order("recorded_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((d: Record<string, unknown>) => ({
        id: d.id as string, hazard_id: d.hazard_id as string, scanner_id: d.scanner_id as string,
        scanner_label: ((d.scanner as { label?: string } | null)?.label) ?? null,
        recorded_at: d.recorded_at as string, severity: d.severity as number,
        speed_mps: (d.speed_mps as number | null) ?? null, photo_url: (d.photo_url as string | null) ?? null,
      }));
    },

    async dismiss(hazardId) {
      const { error } = await client.from("hazards").update({ status: "false_positive" }).eq("id", hazardId);
      if (error) throw new Error(error.message);
    },

    planRoute: (req) => postJson("/api/plan-route", req),
    async dispatch(req): Promise<DispatchResult> {
      // The endpoint publishes the plan whether or not the email went out, so
      // the console needs `sent` and the crew page link, not just a resolved
      // promise. Field names are snake_case on the wire.
      const res = await postJson<{ sent: boolean; crew_page: string; message_id?: string }>("/api/dispatch", req);
      return {
        sent: res.sent, crewPage: res.crew_page,
        ...(res.message_id === undefined ? {} : { messageId: res.message_id }),
      };
    },
  };
}
