"""Export a local night replay. Run: python3 -m pipeline.replay YYYY-MM-DD.

Reads Supabase with the server key. The gitignored snapshot contains filtered
travel paths, never incident locations, device labels, credentials or session IDs.
"""
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pipeline.run import ROOT, env, fetch, point
from pipeline.recording_windows import SELECTION, window_index


def export(day, raw=False):
    end = datetime.fromisoformat(day).replace(hour=6, minute=30, tzinfo=timezone.utc)
    start = (end - timedelta(days=1)).replace(hour=17, minute=0)
    groups = defaultdict(list)
    total = 0
    for r in fetch(env(), 'light_readings', 'session_id,recorded_at,location,gps_accuracy_m,speed_mps'):
        t = datetime.fromisoformat(r['recorded_at'])
        window = window_index(t)
        if window is None or (not raw and not start <= t < end):
            continue
        total += 1
        if not raw and (r['gps_accuracy_m'] is None or r['gps_accuracy_m'] > 20):
            continue
        lng, lat = point(r['location'])
        if not raw and not (-3.4 < lng < -3 and 55.8 < lat < 56.1):
            continue
        groups[(r['session_id'], window)].append([t.timestamp(), lng, lat, r['gps_accuracy_m']] if raw else [round(t.timestamp()), round(lng, 6), round(lat, 6)])
    paths = []
    accepted = 0
    for rows in sorted(groups.values(), key=lambda rows: min(r[0] for r in rows)):
        rows.sort(key=lambda row: row[0])
        if raw:
            paths.append(rows)
            accepted += len(rows)
            continue
        path = []
        for row in rows:
            if path:
                prev = path[-1]
                dt = row[0] - prev[0]
                if dt <= 0:
                    continue
                if dt > 90:
                    if len(path) > 1:
                        paths.append(path)
                    path = []
                elif dt < 10:
                    continue
            path.append(row)
            accepted += 1
        if len(path) > 1:
            paths.append(path)
    if not paths:
        raise SystemExit('No usable night paths; existing snapshot preserved.')
    result = dict(date=day, start=min(p[0][0] for p in paths), end=max(p[-1][0] for p in paths),
                  readings=total, sessions=len({key[0] for key in groups}), paths=paths, unfiltered=raw, selection=SELECTION,
                  note='Every light reading within the three selected GMT windows, at its original timestamp and coordinates. No GPS quality, speed, geographic, downsampling, gap or jump filters. Sessions and selected windows remain separate.' if raw else 'Selected GMT windows only. GPS accuracy ≤20 m; no speed limit. Samples spaced ≥10 s. Gaps over 90 s split the trails.')
    target = ROOT / ('.env.replay.raw.json' if raw else '.env.replay.json')
    tmp = target.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(result, separators=(',', ':')))
    tmp.chmod(0o600)
    tmp.replace(target)
    print(f'{total} readings → {len(paths)} continuous trails, {accepted} samples; {target.name}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--raw']
    export(args[0] if args else datetime.now(timezone.utc).date().isoformat(), raw='--raw' in sys.argv)
