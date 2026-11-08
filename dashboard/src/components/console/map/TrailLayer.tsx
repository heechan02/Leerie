"use client";
import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { useConsole } from "@/lib/console/store";
import { MAP_FALLBACK, readToken } from "@/lib/map/tokens";

export function TrailLayer() {
  const scanners = useConsole((s) => s.scanners);
  const action = useMemo(() => readToken("--action", MAP_FALLBACK.action), []);
  const data = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: Object.values(scanners).flatMap((v) => {
      const older = v.trail.slice(0, -1).reverse(); // exclude the current point; nearest first
      return older.map((p, k) => ({
        type: "Feature" as const,
        properties: { opacity: Math.max(0.1, 0.28 - k * 0.045) },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      }));
    }),
  }), [scanners]);

  return (
    <Source id="trails" type="geojson" data={data}>
      <Layer id="trail-dots" type="circle" paint={{ "circle-radius": 2.5, "circle-color": action, "circle-opacity": ["get", "opacity"] }} />
    </Source>
  );
}
