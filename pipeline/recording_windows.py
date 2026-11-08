"""One shared time selection for production street summaries and travel replays."""
import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

SELECTION = json.loads((Path(__file__).resolve().parent.parent / 'data' / 'recording_windows.json').read_text())
ZONE = ZoneInfo(SELECTION['timezone'])
# User-specified end seconds are inclusive, including fractional timestamps in that second.
WINDOWS = [
    (datetime.fromisoformat(f"{SELECTION['date']}T{start}").replace(tzinfo=ZONE),
     datetime.fromisoformat(f"{SELECTION['date']}T{end}").replace(tzinfo=ZONE) + timedelta(seconds=1))
    for start, end in SELECTION['windows']
]


def window_index(timestamp):
    t = datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else timestamp
    if t.tzinfo is None:
        raise ValueError('Recording timestamps must include a timezone')
    return next((i for i, (start, end) in enumerate(WINDOWS) if start <= t < end), None)


def selected(rows, field):
    return [r for r in rows if window_index(r[field]) is not None]
