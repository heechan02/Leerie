"""python3 -m pipeline.test_run"""

import struct

from pipeline.run import pct, point, seg_dist, xy

# PostGIS EWKB for SRID=4326;POINT(-3.18 55.93), little-endian.
ewkb = (b"\x01" + struct.pack("<I", 0x20000001) + struct.pack("<I", 4326) + struct.pack("<dd", -3.18, 55.93)).hex()
assert point(ewkb) == (-3.18, 55.93)
assert point((b"\x01" + struct.pack("<I", 1) + struct.pack("<dd", 1.0, 2.0)).hex()) == (1.0, 2.0)  # no SRID

a, b = xy(-3.18, 55.93), xy(-3.17, 55.93)
assert 620 < b[0] - a[0] < 630  # 0.01° of longitude at 55.93°N ≈ 624 m
assert seg_dist((5, 3), (0, 0), (10, 0)) == 3
assert seg_dist((-4, 3), (0, 0), (10, 0)) == 5
assert pct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9) == 10
print("ok")
