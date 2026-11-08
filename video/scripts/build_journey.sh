#!/usr/bin/env bash
# Builds the "road to the office" terrain flyover clip (journey.html).
# Usage: scripts/build_journey.sh [v|h]   v = 1080x1920 (default), h = 1920x1080
# Needs node + playwright (Chromium), `npm install` (maplibre-gl), python3 with numpy/scipy, ffmpeg.
# The 3D map is drawn with software WebGL, so a full render takes roughly 20-30 minutes.
set -euo pipefail
cd "$(dirname "$0")/.."
FMT=${1:-v}
[ -d node_modules/maplibre-gl ] || npm install
python3 scripts/fetch_fonts.py
python3 scripts/make_audio_journey.py output/audio_journey.wav
if [ "$FMT" = h ]; then FR=output/journey_frames_h; OUT=output/suminmom_journey.mp4
else FR=output/journey_frames; OUT=output/suminmom_journey_vertical.mp4; fi
rm -rf "$FR"
node scripts/render_journey.js --fmt "$FMT" --out "$FR" --workers "${WORKERS:-3}"
CRF=${CRF:-26} FRAMES="$FR" AUDIO=output/audio_journey.wav ./scripts/encode.sh "$OUT"
