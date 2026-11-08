"""python3 -m pipeline.test_run"""

import struct

from pipeline.run import lamp_stats, local_light, midpoint, pct, point, seg_dist, should_inspect, xy

# PostGIS EWKB for SRID=4326;POINT(-3.18 55.93), little-endian.
ewkb = (b"\x01" + struct.pack("<I", 0x20000001) + struct.pack("<I", 4326) + struct.pack("<dd", -3.18, 55.93)).hex()
assert point(ewkb) == (-3.18, 55.93)
assert point((b"\x01" + struct.pack("<I", 1) + struct.pack("<dd", 1.0, 2.0)).hex()) == (1.0, 2.0)  # no SRID

a, b = xy(-3.18, 55.93), xy(-3.17, 55.93)
assert 620 < b[0] - a[0] < 630  # 0.01° of longitude at 55.93°N ≈ 624 m
assert seg_dist((5, 3), (0, 0), (10, 0)) == 3
assert seg_dist((-4, 3), (0, 0), (10, 0)) == 5
assert pct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9) == 10
assert midpoint([(0, 0), (2, 0), (100, 0)]) == (50, 0)

# Two dim streets near each other keep their own scale, regardless of a distant bright road.
centres = [(0, 0), (20, 0), (100, 0), (10, 0)]
measured = {0: (-5, -6, -4, 3, 1), 1: (-4, -5, -3, 3, 1), 2: (7, 6, 8, 3, 1)}
stops, lo, hi, expected, light, light_lo = local_light(centres, measured)
assert (stops[0], lo[0], hi[0], expected[0], light[0], light_lo[0]) == (-0.5, -1.5, 0.5, 0.5, 0.25, 0)
assert (stops[1], light[1]) == (0.5, 0.75)
assert 2 not in stops and 2 not in light
assert (stops[3], light[3]) == (0, 0.5)

# A bright road inside the radius cannot lift the prediction above both closest dim streets.
centres[2] = (40, 0)
stops, _, _, expected, light, _ = local_light(centres, measured)
assert (stops[3], expected[3], light[3]) == (0, 0, 0.5)

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
