import type {
  Crew, HazardMapRow, ScannerPositionRow, PlanRouteRequest, PlanRouteResponse, DispatchRequest,
} from "@/lib/types";

export type { Crew, PlanRouteRequest, PlanRouteResponse, DispatchRequest };

/** A hazard as the console shows it: the hazards_map row plus display fields. */
export type Hazard = HazardMapRow & {
  street: string | null; // road_name; null renders as the coordinate
  ref: string;           // "BCH-" + first 4 hex of the id, uppercase
  stop_order: number | null; // set while scheduled on a route
};

export interface ScannerPosition {
  scanner_id: string;
  lng: number;
  lat: number;
  recorded_at: string;
  speed_mps: number | null;
  heading_deg: number | null;
}

export interface Scanner {
  id: string;
  label: string;
  fleet_type: string;
  position: ScannerPosition;
  trail: ScannerPosition[]; // most recent last, max 5
}

export interface Detection {
  id: string;
  hazard_id: string;
  scanner_id: string;
  scanner_label: string | null;
  recorded_at: string;
  severity: number;
  speed_mps: number | null;
  photo_url: string | null;
}

export type HazardUpdate = Hazard | { id: string; deleted: true };

/**
 * What the dispatch endpoint answered. `sent` is false when the email service
 * is not configured: the plan is still published and the crew page still
 * works, so the console has to say which of the two happened.
 */
export interface DispatchResult {
  sent: boolean;
  crewPage: string;
  messageId?: string;
}

export interface LoadResult {
  hazards: Hazard[];
  scanners: Scanner[];
  crews: Crew[];
  kmToday: number;
}

export interface SubscribeHandlers {
  onHazard(p: HazardUpdate): void;
  onScanner(v: Scanner): void;
  /** Synthetic-only: the source's own running km-today total after a tick. */
  onKmToday?(km: number): void;
}

export interface ConsoleDataSource {
  load(): Promise<LoadResult>;
  subscribe(handlers: SubscribeHandlers): () => void;
  detections(hazardId: string): Promise<Detection[]>;
  dismiss(hazardId: string): Promise<void>;
  planRoute(req: PlanRouteRequest): Promise<PlanRouteResponse>;
  dispatch(req: DispatchRequest): Promise<DispatchResult>;
}

export function hazardRef(id: string): string {
  return "BCH-" + id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

export function toHazard(row: HazardMapRow, stop_order: number | null = null): Hazard {
  return { ...row, street: row.road_name, ref: hazardRef(row.id), stop_order };
}

export function toScanner(row: ScannerPositionRow): Scanner {
  const position: ScannerPosition = {
    scanner_id: row.scanner_id, lng: row.lng, lat: row.lat, recorded_at: row.recorded_at,
    speed_mps: row.speed_mps, heading_deg: row.heading_deg,
  };
  return { id: row.scanner_id, label: row.label, fleet_type: row.fleet_type, position, trail: [position] };
}
