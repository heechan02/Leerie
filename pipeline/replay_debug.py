"""Build local-only replay diagnostics: python3 -m pipeline.replay_debug."""
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pipeline.run import ROOT, DATA, env, fetch, point, xy, seg_dist, MAX_ACCURACY_M, MATCH_M, MIN_ROWS
from pipeline.recording_windows import SELECTION, selected


class StreetMatcher:
    def __init__(self, ways):
        self.ways = ways
        self.points = [[xy(g['lon'], g['lat']) for g in w['geometry']] for w in ways]
        self.grid = defaultdict(set)
        for i, ps in enumerate(self.points):
            for x in range(math.floor(min(p[0] for p in ps)/100), math.floor(max(p[0] for p in ps)/100)+1):
                for y in range(math.floor(min(p[1] for p in ps)/100), math.floor(max(p[1] for p in ps)/100)+1):
                    self.grid[x,y].add(i)

    def nearest(self, p):
        cx, cy = math.floor(p[0]/100), math.floor(p[1]/100)
        tested = set()
        best, best_d = None, math.inf
        radius = 1
        while True:
            candidates = set().union(*(self.grid.get((x,y), set()) for x in range(cx-radius,cx+radius+1) for y in range(cy-radius,cy+radius+1))) - tested
            for i in sorted(candidates):
                d = min(seg_dist(p,a,b) for a,b in zip(self.points[i],self.points[i][1:]))
                if d < best_d or (d == best_d and (best is None or i > best)):
                    best, best_d = i, d
            tested.update(candidates)
            edge = min(p[0]-(cx-radius)*100, (cx+radius+1)*100-p[0], p[1]-(cy-radius)*100, (cy+radius+1)*100-p[1])
            if best_d <= edge or len(tested) == len(self.ways):
                return best, best_d
            radius *= 2


def sample_key(t, lng, lat):
    # Mirrors JS Math.round for positive epoch timestamps.
    return f'{math.floor(t+.5)}:{lng:.6f}:{lat:.6f}'


def export():
    rows = selected(fetch(env(), 'light_readings', 'session_id,recorded_at,location,gps_accuracy_m,speed_mps,brightness,iso,exposure_s,aperture,device_model'), 'recorded_at')
    ways = [w for w in json.loads((DATA/'osm_ways.json').read_text())['elements'] if len(w.get('geometry', [])) > 1]
    matcher = StreetMatcher(ways)
    counts = Counter()
    sessions = defaultdict(set)
    details = []
    bounds = [min(g['lon'] for w in ways for g in w['geometry']), min(g['lat'] for w in ways for g in w['geometry']), max(g['lon'] for w in ways for g in w['geometry']), max(g['lat'] for w in ways for g in w['geometry'])]
    for r in rows:
        lng, lat = point(r['location'])
        i, distance = matcher.nearest(xy(lng,lat))
        quality = (r['brightness'] or 0)>0 and (r['gps_accuracy_m'] or 99)<=MAX_ACCURACY_M
        matched = i is not None and distance <= MATCH_M
        if quality and matched:
            counts[i] += 1
            sessions[i].add(r['session_id'])
        details.append((r,lng,lat,i,distance,quality,matched))
    result = {}
    reasons = Counter()
    for r,lng,lat,i,distance,quality,matched in details:
        blockers = []
        if not (r['brightness'] or 0)>0: blockers.append('Brightness is missing or nonpositive')
        if (r['gps_accuracy_m'] or 99)>MAX_ACCURACY_M: blockers.append(f'GPS accuracy must be positive and ≤{MAX_ACCURACY_M} m')
        if not matched: blockers.append(f'No imported street within {MATCH_M} m')
        elif counts[i]<MIN_ROWS: blockers.append(f'Street has {counts[i]} eligible readings; needs {MIN_ROWS}')
        for reason in blockers: reasons[reason]+=1
        w = ways[i] if i is not None else None
        t = datetime.fromisoformat(r['recorded_at']).timestamp()
        result[sample_key(t,lng,lat)] = {
            'recorded_at':r['recorded_at'], 'lng':lng, 'lat':lat, 'accuracy_m':r['gps_accuracy_m'],
            'speed_mps':r['speed_mps'], 'brightness':r['brightness'], 'iso':r['iso'],
            'exposure_s':r['exposure_s'], 'aperture':r['aperture'], 'device_model':r['device_model'],
            'nearest_street': (w.get('tags',{}).get('name') or 'Unnamed '+w.get('tags',{}).get('highway','way')) if w else None,
            'osm_way_id':w['id'] if w else None, 'distance_m':round(distance,2) if math.isfinite(distance) else None,
            'eligible_readings':counts[i] if matched else None, 'passes':len(sessions[i]) if matched else None,
            'included':not blockers, 'blockers':blockers,
            'outside_network_bounds':not (bounds[0]<=lng<=bounds[2] and bounds[1]<=lat<=bounds[3]),
        }
    payload = dict(generated_at=datetime.now(timezone.utc).isoformat(),selection=SELECTION, points=result,
                   thresholds=dict(gps_accuracy_m=MAX_ACCURACY_M,match_m=MATCH_M,min_readings=MIN_ROWS,speed_limit=None),network_bounds=bounds)
    target=ROOT/'.env.replay.debug.json'; tmp=target.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(payload,separators=(',',':')));tmp.chmod(0o600);tmp.replace(target)
    print(f'Debugged {len(rows)} selected readings: {sum(d["included"] for d in result.values())} included; blockers (overlap): {dict(reasons)}')


if __name__ == '__main__':
    export()
