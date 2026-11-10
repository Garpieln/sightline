#!/usr/bin/env bash
# Extract what's needed to read chords from a video:
#   frames/      one frame every N seconds plus every scene change (on-screen labels, hands)
#   sheet-*.jpg  contact sheets of those frames (4x4 grids) for a quick look
#   first.jpg    the first frame (creator handle / title card often appears here)
#   audio.wav    mono 22.05 kHz audio for audio_chords.py
# Usage: tools/video/frames.sh <video> <out-dir> [seconds-between-frames=1]
set -euo pipefail
VIDEO="$1"; OUT="$2"; STEP="${3:-1}"
mkdir -p "$OUT/frames"
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of default=nw=1 "$VIDEO" > "$OUT/info.txt" || true
ffmpeg -v error -y -i "$VIDEO" -vf "select='isnan(prev_selected_t)+gte(t-prev_selected_t\,$STEP)+gt(scene\,0.3)',scale=640:-2" -vsync vfr -q:v 3 "$OUT/frames/f%04d.jpg"
ffmpeg -v error -y -i "$VIDEO" -vf "select=eq(n\,0),scale=960:-2" -frames:v 1 "$OUT/first.jpg"
ffmpeg -v error -y -pattern_type glob -i "$OUT/frames/*.jpg" -vf "scale=320:-2,tile=4x4:padding=4:color=white" -q:v 4 "$OUT/sheet-%02d.jpg"
ffmpeg -v error -y -i "$VIDEO" -vn -ac 1 -ar 22050 "$OUT/audio.wav" 2>/dev/null || echo "no audio track"
echo "frames: $(ls "$OUT/frames" | wc -l)  sheets: $(ls "$OUT"/sheet-*.jpg 2>/dev/null | wc -l)  audio: $([ -f "$OUT/audio.wav" ] && echo yes || echo no)"
