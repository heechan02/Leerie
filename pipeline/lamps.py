"""One-off: council street lighting columns (British National Grid CSV) -> data/lamps.geojson, clipped to our streets.

python3 -m pipeline.lamps ~/Downloads/Street_Lighting_Columns.csv   (needs pyproj; run.py does not)
"""

import csv
import json
import sys

from pyproj import Transformer

from pipeline.run import DATA

MARGIN_DEG = 0.0015  # about 100 m

ways = json.loads((DATA / "osm_ways.json").read_text())["elements"]
lons = [g["lon"] for w in ways for g in w.get("geometry", [])]
lats = [g["lat"] for w in ways for g in w.get("geometry", [])]
w, e, s, n = min(lons) - MARGIN_DEG, max(lons) + MARGIN_DEG, min(lats) - MARGIN_DEG, max(lats) + MARGIN_DEG

to_wgs84 = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
feats = []
with open(sys.argv[1], encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f):
        lon, lat = to_wgs84.transform(float(r["X"]), float(r["Y"]))
        if w <= lon <= e and s <= lat <= n:
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                "properties": {"asset_id": r["asset_id"], "site_name": r["site_name"], "lantern": r["lantern_mo"],
                               "support": r["support_ma"], "commission": r["commission"]},
            })
(DATA / "lamps.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
print(f"{len(feats)} lamps -> data/lamps.geojson")
