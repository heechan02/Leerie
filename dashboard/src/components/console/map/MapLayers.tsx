"use client";
import { useConsole } from "@/lib/console/store";
import { HazardPin } from "./HazardPin";
import { ScannerMarker } from "./ScannerMarker";
import { TrailLayer } from "./TrailLayer";
import { RouteLayer } from "./RouteLayer";
import { PreviewDriveLayer } from "./PreviewDriveLayer";
import { CrosshairGuides } from "./CrosshairGuides";

export function MapLayers() {
  const hazards = useConsole((s) => s.hazards);
  const scanners = useConsole((s) => s.scanners);
  return (
    <>
      <TrailLayer />
      {Object.values(hazards).map((p) => <HazardPin key={p.id} p={p} />)}
      {Object.values(scanners).map((v) => <ScannerMarker key={v.id} v={v} />)}
      <RouteLayer />
      <PreviewDriveLayer />
      <CrosshairGuides />
    </>
  );
}
