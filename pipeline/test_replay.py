"""python3 -m unittest pipeline.test_replay"""
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from pipeline import replay


class RawReplayTest(unittest.TestCase):
    def test_raw_keeps_all_quality_levels_but_splits_selected_windows(self):
        rows = [
            dict(session_id='private-session', recorded_at=t, location=loc,
                 gps_accuracy_m=accuracy, speed_mps=speed)
            for t, loc, accuracy, speed in [
                ('2026-11-08T02:24:14.123+00:00', (-3.18, 55.93), None, None),
                ('2026-11-08T02:24:14.123+00:00', (-3.19, 55.94), 500, 50),
                ('2026-11-08T04:00:00.456+00:00', (0.1, 51.5), 100, 100),
                ('2026-11-08T03:30:00+00:00', (0.2, 51.6), 3, 1),
            ]
        ]
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(replay, 'ROOT', Path(folder)), patch.object(replay, 'env', return_value={}), patch.object(replay, 'fetch', return_value=rows), patch.object(replay, 'point', side_effect=lambda value: value):
                replay.export('2026-11-08', raw=True)
            snapshot = (Path(folder) / '.env.replay.raw.json').read_text()
            data = json.loads(snapshot)
            self.assertEqual(sum(map(len, data['paths'])), 3)
            self.assertEqual(data['paths'][1][-1], [datetime.fromisoformat(rows[2]['recorded_at']).timestamp(), .1, 51.5, 100])
            self.assertNotIn('private-session', snapshot)
            self.assertTrue(data['unfiltered'])
            self.assertEqual([p[3] for path in data['paths'] for p in path], [None, 500, 100])
            self.assertEqual(len(data['paths']), 2)


if __name__ == '__main__':
    unittest.main()
