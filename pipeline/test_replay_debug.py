import json
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pipeline import replay_debug as debug
from pipeline.run import xy, seg_dist


class ReplayDebugTest(unittest.TestCase):
    def test_indexed_nearest_matches_full_search_even_outside_network(self):
        ways = [dict(id=i, geometry=[dict(lon=x, lat=55.94), dict(lon=x, lat=55.945)]) for i,x in enumerate([-3.2,-3.19,-3.18])]
        matcher=debug.StreetMatcher(ways)
        for coord in [(-3.195,55.943),(-3.21,55.96),(-3.19,55.93),(-3.17,55.942)]:
            p=xy(*coord)
            ds=[min(seg_dist(p,a,b) for a,b in zip(ps,ps[1:])) for ps in matcher.points]
            idx,d=matcher.nearest(p)
            self.assertAlmostEqual(d,min(ds))
            self.assertAlmostEqual(ds[idx],min(ds))

    def test_reports_all_blockers_and_preserves_unlimited_speed(self):
        ways={'elements':[dict(id=10,tags={'name':'Test street'},geometry=[dict(lon=-3.181,lat=55.94),dict(lon=-3.179,lat=55.94)])]}
        def row(sec, location, accuracy, brightness):
            return dict(session_id='private-session',recorded_at=f'2026-11-08T02:30:{sec:02d}+00:00',location=location,gps_accuracy_m=accuracy,brightness=brightness,speed_mps=100,iso=200,exposure_s=.01,aperture=1.8,device_model='test-phone')
        rows=[row(i,(-3.18,55.94),5,1) for i in range(3)]+[row(3,(-3.2,55.95),99,None)]
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'osm_ways.json').write_text(json.dumps(ways))
            with patch.object(debug,'ROOT',root),patch.object(debug,'DATA',root),patch.object(debug,'env',return_value={}),patch.object(debug,'fetch',return_value=rows),patch.object(debug,'point',side_effect=lambda p:p):debug.export()
            text=(root/'.env.replay.debug.json').read_text();payload=json.loads(text)
            points=list(payload['points'].values())
            self.assertEqual(sum(p['included'] for p in points),3)
            self.assertEqual(len(points[-1]['blockers']),3)
            self.assertTrue(points[-1]['outside_network_bounds'])
            self.assertEqual(points[0]['speed_mps'],100)
            self.assertEqual(points[0]['eligible_readings'],3)
            self.assertNotIn('private-session',text)
            self.assertIsNone(payload['thresholds']['speed_limit'])
