import type { Metadata } from "next";
import { ScanMap } from "@/components/leerie/ScanMap";

export const metadata: Metadata = { title: "Leerie · Live map" };

export default function MapPage() {
  return <ScanMap />;
}
