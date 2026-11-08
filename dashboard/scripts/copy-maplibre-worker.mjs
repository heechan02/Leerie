// Copies MapLibre's ESM worker (and the shared chunk it imports) into public/
// so the browser can load it from a real URL. MapLibre derives the worker URL
// from import.meta.url, which Turbopack does not give it, so the map must be
// told where the worker lives (see ConsoleMap.tsx, setWorkerUrl).
//
// Also copies the repo's data/ files (segments.geojson, validation.json, …)
// into public/data, so the dashboard serves them and runs offline from them.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "maplibre-gl", "dist");
const dest = join(root, "public", "maplibre");
mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log("maplibre worker copied to public/maplibre");

const data = join(root, "..", "data");
const dataDest = join(root, "public", "data");
mkdirSync(dataDest, { recursive: true });
// This directory is generated: remove stale outputs before copying public aggregates.
for (const f of readdirSync(dataDest)) rmSync(join(dataDest, f), { recursive: true, force: true });
if (existsSync(data)) {
  const publicFiles = ["segments.geojson", "segments.fake.geojson", "lamps.geojson", "recording_windows.json", "validation.json"];
  const files = publicFiles.filter((f) => existsSync(join(data, f)));
  for (const f of files) copyFileSync(join(data, f), join(dataDest, f));
  console.log(`data copied to public/data: ${files.join(", ")}`);
}
