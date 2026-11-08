import unittest
from pipeline.recording_windows import SELECTION, selected, window_index


class RecordingWindowsTest(unittest.TestCase):
    def test_each_window_includes_start_and_entire_end_second(self):
        for i, (start, end) in enumerate(SELECTION['windows']):
            self.assertEqual(window_index(f"2026-11-08T{start}+00:00"), i)
            self.assertEqual(window_index(f"2026-11-08T{end}.999999+00:00"), i)

    def test_excludes_gaps_and_other_dates(self):
        for time in ['02:24:13.999999', '03:16:22', '03:53:54.999999', '04:52:06', '05:31:59.999999', '06:22:01']:
            self.assertIsNone(window_index(f'2026-11-08T{time}+00:00'))
        self.assertIsNone(window_index('2026-11-09T02:30:00+00:00'))

    def test_readings_and_reports_share_the_same_selection(self):
        for field in ['recorded_at', 'created_at']:
            rows = [{field: '2026-11-08T03:00:00+00:00'}, {field: '2026-11-08T03:30:00+00:00'}]
            self.assertEqual(selected(rows, field), rows[:1])

    def test_compares_instants_across_timezone_offsets(self):
        self.assertEqual(window_index('2026-11-08T04:00:00+01:00'), 0)
