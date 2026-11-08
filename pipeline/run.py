"""Pipeline v0: Supabase readings -> data/segments.geojson.

Run from the repo root:  python3 -m pipeline.run
Needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env (the app's key cannot read rows).

shortcut: segments are whole OSM ways (not split at junctions), matching ignores walking bearing,
no phone calibration, prediction is the mean of measured neighbours within 150 m, C (SIMD) is null.
Upgrade to OSMnx segments + the brief's model once pandas/osmnx are installed.
"""

import json
import math
import statistics
import struct
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MAX_ACCURACY_M = 15
MAX_SPEED_MPS = 3
MATCH_M = 15
NEIGHBOUR_M = 150
MIN_ROWS = 3
UNCOMFORTABLE = {"dark", "followed", "harassment", "other"}


def env() -> dict:
    out = {}
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    if not out.get("SUPABASE_SECRET_KEY"):
        raise SystemExit("Put SUPABASE_SECRET_KEY in .env first.")
    return out


def fetch(e: dict, table: str, select: str) -> list[dict]:
    """All rows, 1000 at a time. curl, because this Python has no CA certificates."""
    rows, start = [], 0
    while True:
        out = subprocess.run(
            ["curl", "-sf", f"{e['SUPABASE_URL'].rstrip('/')}/rest/v1/{table}?select={select}&order=id",
             "-H", f"apikey: {e['SUPABASE_SECRET_KEY']}",
             "-H", f"Authorization: Bearer {e['SUPABASE_SECRET_KEY']}",
             "-H", f"Range: {start}-{start + 999}"],
            capture_output=True, text=True, check=True,
        ).stdout
        page = json.loads(out)
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def point(hex_ewkb: str) -> tuple[float, float]:
    """PostgREST returns geography as hex EWKB: byte order, type (+SRID flag), SRID, x, y."""
    b = bytes.fromhex(hex_ewkb)
    end = "<" if b[0] == 1 else ">"
    (kind,) = struct.unpack(end + "I", b[1:5])
    off = 9 if kind & 0x20000000 else 5
    return struct.unpack(end + "dd", b[off : off + 16])


def xy(lon: float, lat: float) -> tuple[float, float]:
    """Local metres; fine across a 3 km study area."""
    return (lon + 3.18) * 111320 * math.cos(math.radians(55.93)), (lat - 55.93) * 110540


def seg_dist(p, a, b) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = 0 if dx == dy == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def pct(values: list[float], q: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(q * len(s)))]


def main() -> None:
    e = env()
    readings = fetch(e, "light_readings", "session_id,recorded_at,location,gps_accuracy_m,speed_mps,brightness")
    incidents = fetch(e, "incidents", "session_id,location,category")

    # Clean: GPS accuracy, walking pace, exposure present, and darkness only (drop 06:30-16:00 UTC; Nov = GMT).
    clean = []
    for r in readings:
        t = datetime.fromisoformat(r["recorded_at"])
        day = (t.hour, t.minute) >= (6, 30) and t.hour < 16
        if (r["brightness"] or 0) <= 0 or (r["gps_accuracy_m"] or 99) > MAX_ACCURACY_M or (r["speed_mps"] or 0) > MAX_SPEED_MPS or day:
            continue
        clean.append((xy(*point(r["location"])), r["session_id"], math.log2(r["brightness"])))

    ways = [w for w in json.loads((DATA / "osm_ways.json").read_text())["elements"] if len(w.get("geometry", [])) > 1]
    pts = [[xy(g["lon"], g["lat"]) for g in w["geometry"]] for w in ways]
    boxes = [(min(p[0] for p in ps) - MATCH_M, min(p[1] for p in ps) - MATCH_M,
              max(p[0] for p in ps) + MATCH_M, max(p[1] for p in ps) + MATCH_M) for ps in pts]

    def nearest(p):
        best, best_d = None, MATCH_M
        for i, (x0, y0, x1, y1) in enumerate(boxes):
            if x0 <= p[0] <= x1 and y0 <= p[1] <= y1:
                d = min(seg_dist(p, a, b) for a, b in zip(pts[i], pts[i][1:]))
                if d <= best_d:
                    best, best_d = i, d
        return best

    # Match and aggregate: median log2 per (segment, session), then median over sessions.
    per = {}
    for p, session, lb in clean:
        i = nearest(p)
        if i is not None:
            per.setdefault(i, {}).setdefault(session, []).append(lb)
    measured = {}
    for i, sessions in per.items():
        rows = [v for vs in sessions.values() for v in vs]
        if len(rows) >= MIN_ROWS:
            measured[i] = (statistics.median(statistics.median(v) for v in sessions.values()),
                           pct(rows, 0.1), pct(rows, 0.9), len(rows), len(sessions))
    if not measured:
        raise SystemExit(f"No segment has {MIN_ROWS}+ clean readings yet ({len(readings)} rows, {len(clean)} clean).")
    ref = statistics.median(m[0] for m in measured.values())

    # Predict: mean of measured neighbours within 150 m (by way midpoint), interval widened by 1 stop.
    mid = [ps[len(ps) // 2] for ps in pts]
    stops, lo, hi = {}, {}, {}
    for i, (med, p10, p90, _, _) in measured.items():
        stops[i], lo[i], hi[i] = med - ref, p10 - ref, p90 - ref
    for i in range(len(ways)):
        if i in measured:
            continue
        near = [stops[j] for j in measured if math.dist(mid[i], mid[j]) <= NEIGHBOUR_M]
        if near:
            m = statistics.mean(near)
            spread = (statistics.pstdev(near) if len(near) > 1 else 0) + 1
            stops[i], lo[i], hi[i] = m, m - spread, m + spread

    # Reports: uncomfortable taps within 15 m; confirmed once two different sessions agree.
    reports = {}
    for r in incidents:
        if r["category"] in UNCOMFORTABLE:
            i = nearest(xy(*point(r["location"])))
            if i is not None:
                reports.setdefault(i, []).append(r["session_id"])

    def rank(values: dict) -> dict:
        order = sorted(values, key=values.get)
        return {k: (n / (len(order) - 1) if len(order) > 1 else 0.5) for n, k in enumerate(order)}

    L, L_lo = rank(stops), rank(lo)
    feats = []
    for i, w in enumerate(ways):
        t = w.get("tags", {})
        sessions = reports.get(i, [])
        confirmed = int(len({s for s in sessions if s}) >= 2)
        passes = measured[i][4] if i in measured else 0
        R = (len(sessions) + 1) / (passes + 10)
        score = None if i not in L else round(100 * (0.5 * L[i] + 0.3 * (1 - R) + 0.2 * 0.5), 1)
        score_lo = None if i not in L_lo else round(100 * (0.5 * L_lo[i] + 0.3 * (1 - R) + 0.2 * 0.5), 1)
        length = sum(math.dist(a, b) for a, b in zip(pts[i], pts[i][1:]))
        r2 = lambda v: None if v is None else round(v, 2)  # noqa: E731
        feats.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[g["lon"], g["lat"]] for g in w["geometry"]]},
            "properties": {
                "segment_id": f"{w['nodes'][0]}-{w['nodes'][-1]}-{w['id']}", "u": w["nodes"][0], "v": w["nodes"][-1],
                "name": t.get("name"), "highway": t.get("highway"), "osm_lit": t.get("lit"), "length_m": round(length, 1),
                "measured": i in measured, "n_readings": measured[i][3] if i in measured else 0, "passes": passes,
                "brightness": round(2 ** measured[i][0], 6) if i in measured else None,
                "brightness_stops": r2(stops.get(i)), "brightness_lo": r2(lo.get(i)), "brightness_hi": r2(hi.get(i)),
                "expected_stops": None, "lamps_per_100m": None, "nearest_lamp_m": None, "inspect": False,
                "usage": None, "forecast": False,
                "reports_possible": len(sessions) - confirmed, "reports_confirmed": confirmed,
                "simd_crime_rate": None, "L": r2(L.get(i)), "R": round(R, 3), "C": None,
                "score": score, "score_lo": score_lo,
            },
        })
    (DATA / "segments.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    print(f"{len(readings)} readings, {len(clean)} clean, {sum(len(v) for s in per.values() for v in s.values())} matched; "
          f"{len(measured)} segments measured, {len(stops) - len(measured)} predicted, {len(incidents)} reports -> data/segments.geojson")


if __name__ == "__main__":
    main()
