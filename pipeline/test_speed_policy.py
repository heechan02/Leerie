import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pipeline import replay, run


class NoSpeedLimitTest(unittest.TestCase):
    def test_filtered_replay_retains_high_reported_and_inferred_speed(self):
        rows = [dict(session_id='walk', recorded_at=f'2026-11-08T02:30:{sec}+00:00', location=loc,
                     gps_accuracy_m=5, speed_mps=100)
                for sec, loc in [('00', (-3.18, 55.93)), ('10', (-3.1785, 55.93))]]
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(replay, 'ROOT', Path(folder)), patch.object(replay, 'env', return_value={}), patch.object(replay, 'fetch', return_value=rows), patch.object(replay, 'point', side_effect=lambda value: value):
                replay.export('2026-11-08')
            result = json.loads((Path(folder) / '.env.replay.json').read_text())
            self.assertEqual(len(result['paths']), 1)
            self.assertEqual(len(result['paths'][0]), 2)

    def test_street_aggregation_keeps_high_speed_readings(self):
        rows = [dict(session_id='walk', recorded_at='2026-11-08T02:30:00+00:00', location=(-3.18, 55.93),
                     brightness=1, gps_accuracy_m=5, speed_mps=100) for _ in range(3)]
        ways = {'elements': [dict(id=1, nodes=[1, 2], geometry=[dict(lon=-3.181, lat=55.93), dict(lon=-3.179, lat=55.93)], tags={'name': 'Test street'})]}
        with tempfile.TemporaryDirectory() as folder:
            data = Path(folder)
            (data / 'osm_ways.json').write_text(json.dumps(ways))
            (data / 'lamps.geojson').write_text(json.dumps({'features': []}))
            with patch.object(run, 'DATA', data), patch.object(run, 'env', return_value={}), patch.object(run, 'fetch', side_effect=[rows, []]), patch.object(run, 'point', side_effect=lambda value: value):
                run.main()
            street = json.loads((data / 'segments.geojson').read_text())['features'][0]['properties']
            self.assertTrue(street['measured'])
            self.assertEqual(street['n_readings'], 3)


if __name__ == '__main__':
    unittest.main()
