#!/bin/sh
# While scanning: re-run the pipeline every minute and copy the result into the dashboard,
# which re-reads it every minute. Stop with Ctrl-C.
cd "$(dirname "$0")/.." || exit 1
while true; do
  python3 -m pipeline.run && node dashboard/scripts/copy-maplibre-worker.mjs > /dev/null
  sleep 60
done
