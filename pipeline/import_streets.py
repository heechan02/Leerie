"""Reimport all OSM highway ways around every recorded journey (plus 500 m).

python3 -m pipeline.import_streets
Existing map extent is retained. Full geometry is downloaded, never clipped at
query edges. A failed/partial response leaves the existing file untouched.
"""
import json
import math
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from pipeline.run import ROOT, DATA, env, fetch, point

ENDPOINTS = ['https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter']
PADDING_M = 500


def import_bounds(coordinates, previous):
    if not coordinates:
        raise ValueError('No recorded coordinates; refusing an empty import')
    if not all(math.isfinite(x) and math.isfinite(y) and -180<=x<=180 and -90<=y<=90 for x,y in coordinates):
        raise ValueError('Invalid recorded coordinate')
    lons,lats=zip(*coordinates)
    lat=(min(lats)+max(lats))/2
    pad_lat=PADDING_M/110540
    pad_lon=PADDING_M/(111320*math.cos(math.radians(lat)))
    old=[(g['lon'],g['lat']) for w in previous.get('elements',[]) for g in w.get('geometry',[])]
    west=min(min(lons)-pad_lon,min((x for x,y in old),default=min(lons)))
    south=min(min(lats)-pad_lat,min((y for x,y in old),default=min(lats)))
    east=max(max(lons)+pad_lon,max((x for x,y in old),default=max(lons)))
    north=max(max(lats)+pad_lat,max((y for x,y in old),default=max(lats)))
    # Round outward to a coarse query rectangle, not individual reading positions.
    return [math.floor(south*1000)/1000,math.floor(west*1000)/1000,math.ceil(north*1000)/1000,math.ceil(east*1000)/1000]


def validate_response(payload):
    if payload.get('remark'):
        raise ValueError(f'Overpass returned a partial/error response: {payload["remark"]}')
    ways=payload.get('elements',[])
    if not ways:
        raise ValueError('Overpass returned no streets')
    for w in ways:
        geometry=w.get('geometry',[])
        if w.get('type')!='way' or not w.get('tags',{}).get('highway') or len(geometry)<2 or len(w.get('nodes',[]))!=len(geometry):
            raise ValueError('Incomplete street geometry in response')
        if not all(math.isfinite(g['lon']) and math.isfinite(g['lat']) for g in geometry):
            raise ValueError('Non-finite street coordinates')
    if len({w['id'] for w in ways}) != len(ways):
        raise ValueError('Duplicate OSM ways')
    return ways


def main():
    previous=json.loads((DATA/'osm_ways.json').read_text())
    readings=fetch(env(),'light_readings','recorded_at,location')
    bounds=import_bounds([point(r['location']) for r in readings],previous)
    south,west,north,east=bounds
    if north-south>.25 or east-west>.4:
        raise ValueError('Recorded extent is unexpectedly large; review coordinates before querying Overpass')
    query=f'[out:json][timeout:60];way["highway"]({south},{west},{north},{east});out body geom;'
    print(f'Reimporting full highway network in {bounds}, covering {len(readings)} readings + {PADDING_M} m',flush=True)
    errors=[]
    for endpoint in ENDPOINTS:
        try:
            with tempfile.NamedTemporaryFile(suffix='.json') as response:
                subprocess.run(['curl','--user-agent','Leerie street importer (https://github.com/heechan02/Leerie)','--fail-with-body','--silent','--show-error','--max-time','90','--get','--data-urlencode','data='+query,endpoint,'-o',response.name],check=True,capture_output=True,text=True)
                payload=json.loads(Path(response.name).read_text())
            ways=validate_response(payload)
            break
        except (subprocess.CalledProcessError,json.JSONDecodeError,ValueError) as error:
            errors.append(f'{endpoint}: {error}')
            print(f'Endpoint failed; trying fallback: {endpoint}',flush=True)
    else:
        raise RuntimeError('\n'.join(errors))
    payload['leerie_import']={'imported_at':datetime.now(timezone.utc).isoformat(),'query_bounds_south_west_north_east':bounds,'padding_m':PADDING_M,'endpoint':endpoint,'query':query,'readings_extent_source':'all recorded light readings; no quality or time filter','street_types':'all highway ways, including footways, pedestrian streets, steps and service roads'}
    temporary=DATA/'osm_ways.json.tmp'
    temporary.write_text(json.dumps(payload,separators=(',',':')))
    temporary.replace(DATA/'osm_ways.json')
    print(f'Imported {len(ways)} complete OSM ways (previously {len(previous["elements"])}).',flush=True)


if __name__=='__main__':
    main()
