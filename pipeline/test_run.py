"""python3 -m pipeline.test_run"""

import struct

from pipeline.run import lamp_stats, pct, point, seg_dist, should_inspect, xy

# PostGIS EWKB for SRID=4326;POINT(-3.18 55.93), little-endian.
ewkb = (b"\x01" + struct.pack("<I", 0x20000001) + struct.pack("<I", 4326) + struct.pack("<dd", -3.18, 55.93)).hex()
assert point(ewkb) == (-3.18, 55.93)
assert point((b"\x01" + struct.pack("<I", 1) + struct.pack("<dd", 1.0, 2.0)).hex()) == (1.0, 2.0)  # no SRID

a, b = xy(-3.18, 55.93), xy(-3.17, 55.93)
assert 620 < b[0] - a[0] < 630  # 0.01° of longitude at 55.93°N ≈ 624 m
assert seg_dist((5, 3), (0, 0), (10, 0)) == 3
assert seg_dist((-4, 3), (0, 0), (10, 0)) == 5
assert pct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9) == 10
# Inspect first: lamped like a typical street but 2+ stops darker than its neighbours.
assert should_inspect(4, 3, stops=-3, expected=-0.5)
assert not should_inspect(4, 3, stops=-2, expected=-0.5)  # only 1.5 stops darker
assert not should_inspect(2, 3, stops=-3, expected=-0.5)  # fewer lamps than typical
assert not should_inspect(0, 0, stops=-3, expected=-0.5)  # no lamps at all is a lighting gap, not a fault
assert not should_inspect(4, 3, stops=-3, expected=None)  # no measured neighbours

grid = {(0, 0): [((10, 5), "A1")], (3, 0): [((150, 0), "B2")]}
nearest, near = lamp_stats([(0, 0), (100, 0)], grid)
assert nearest == 5 and near == [(5, "A1")]  # B2 is 50 m off the end: counted for nearest only if closer
print("ok")
