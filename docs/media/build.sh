#!/usr/bin/env bash
# Regenerate the Show of Hands demo assets (docs/media/*).
#
# Requires ffmpeg and the webp tools (img2webp); everything else is in the repo.
#   brew install ffmpeg webp
#
# Run from the repo root:  bash docs/media/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

OUT="$(mktemp -d)"
PORT=5599
BASE="http://localhost:$PORT"
mkdir -p "$OUT/media" "$OUT/overlays" "$OUT/rec-raw"

echo "==> Building app"
npm run build >/dev/null

echo "==> Starting throwaway server on :$PORT (rate limits off, scratch DB)"
PORT=$PORT DATABASE_PATH="$OUT/demo.db" SHOWHANDS_SECRET="demo-recording-secret" \
  SHOWHANDS_DISABLE_RATE_LIMITS=1 ORIGIN="https://showhands.rexlorenzo.com" \
  node build/index.js >"$OUT/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
# Wait for the server, but don't spin forever if it never comes up.
for _ in $(seq 1 100); do
  curl -sf "$BASE/healthz" >/dev/null && break
  sleep 0.3
done
curl -sf "$BASE/healthz" >/dev/null || { echo "server never became healthy; see $OUT/server.log" >&2; exit 1; }

echo "==> Recording the master loop + stills (Playwright)"
BASE_URL="$BASE" OUT_DIR="$OUT" node docs/media/record-demo.mjs
RAW="$(ls "$OUT"/rec-raw/*.webm | head -1)"

echo "==> Rendering caption + end-card overlays (Playwright)"
OUT_DIR="$OUT" node docs/media/render-overlays.mjs

echo "==> Master MP4 (source of truth)"
ffmpeg -y -i "$RAW" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p \
  -movflags +faststart "$OUT/master.mp4" -loglevel error

echo "==> Looping WebP for the README (fast, ~0.4 MB, loops forever)"
# Speed 1.3x, 18fps, 520w full-color frames -> img2webp delta-encodes them.
rm -rf "$OUT/wframes"; mkdir -p "$OUT/wframes"
ffmpeg -y -i "$OUT/master.mp4" \
  -vf "setpts=PTS/1.30,fps=18,scale=520:-1:flags=lanczos" "$OUT/wframes/f_%04d.png" -loglevel error
img2webp -loop 0 -d 56 -lossy -q 72 -m 6 "$OUT"/wframes/f_*.png -o docs/media/demo.webp

echo "==> Captioned social MP4 (2x, beat-timed captions -> end card)"
ffmpeg -y -i "$OUT/master.mp4" \
  -i "$OUT/overlays/cap1.png" -i "$OUT/overlays/cap2.png" \
  -i "$OUT/overlays/cap3.png" -i "$OUT/overlays/cap4.png" \
  -filter_complex "\
[0:v]scale=1200:2080:flags=lanczos,setsar=1,fps=30[base];\
[base][1:v]overlay=0:0:enable='between(t,0.8,4.8)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,5.5,8.5)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,10.0,15.6)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,16.7,21.0)'[vb]" \
  -map "[vb]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p "$OUT/body.mp4" -loglevel error
BODYDUR="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT/body.mp4")"
ffmpeg -y -loop 1 -t 2.4 -i "$OUT/overlays/endcard.png" \
  -vf "scale=1200:2080,setsar=1,fps=30" -c:v libx264 -crf 18 -preset medium \
  -pix_fmt yuv420p "$OUT/end.mp4" -loglevel error
OFF="$(awk "BEGIN{print $BODYDUR - 0.5}")"
ffmpeg -y -i "$OUT/body.mp4" -i "$OUT/end.mp4" \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=$OFF,format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -crf 18 -preset slow -movflags +faststart docs/media/demo-social.mp4 -loglevel error

echo "==> Stills"
cp "$OUT"/media/still-*.png docs/media/

echo "==> Done. Regenerated:"
ls -la docs/media/*.webp docs/media/*.mp4 docs/media/still-*.png
