#!/usr/bin/env bash
# Downloads the satellite tiles listed in tiles.txt (z/y/x per line) from Esri World Imagery Wayback.
# The release (a dated snapshot of World Imagery) comes from config.json -> map.release;
# 48925 is the 2025-06-26 capture, which shows the Bucheon office area in summer.
set -euo pipefail
cd "$(dirname "$0")/.."
LIST=${1:-output/tiles.txt}
export REL=$(python3 -c "import json;print(json.load(open('config.json'))['map']['release'])")
export URL="https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/$REL"
grep -v '^$' "$LIST" | xargs -P 8 -I{} sh -c '
  f="assets/tiles/$REL/{}.jpg"
  if [ ! -s "$f" ]; then
    mkdir -p "$(dirname "$f")"
    for i in 1 2 3; do
      curl -sSfL --max-time 30 -A "suminmom-promo-video/1.0" -o "$f.part" "$URL/{}" && mv "$f.part" "$f" && break
      sleep $i
    done
  fi'
echo "tiles on disk: $(find "assets/tiles/$REL" -name '*.jpg' | wc -l)"
