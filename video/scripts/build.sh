#!/usr/bin/env bash
# Full rebuild: fonts -> map tiles -> soundtrack -> frames -> MP4.
# Usage: scripts/build.sh [h|v|all]   h = 1920x1080, v = 1080x1920 mobile cut, all = both (default)
# Needs node + playwright (Chromium), python3 with numpy/scipy, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
WHICH=${1:-all}
mkdir -p output
python3 scripts/fetch_fonts.py
python3 scripts/make_audio.py output/audio.wav
build() {
  local fmt=$1 frames=$2 out=$3
  node scripts/render.js --fmt "$fmt" --collect "output/tiles_$fmt.txt"
  ./scripts/fetch_tiles.sh "output/tiles_$fmt.txt"
  rm -rf "$frames"
  node scripts/render.js --fmt "$fmt" --out "$frames" --workers "${WORKERS:-4}"
  FRAMES="$frames" ./scripts/encode.sh "$out"
}
if [ "$WHICH" = h ] || [ "$WHICH" = all ]; then build h output/frames output/suminmom_promo.mp4; fi
if [ "$WHICH" = v ] || [ "$WHICH" = all ]; then build v output/frames_v output/suminmom_promo_vertical.mp4; fi
