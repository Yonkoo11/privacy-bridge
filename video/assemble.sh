#!/usr/bin/env zsh
setopt +o nomatch
set -e

SCRIPT_DIR="${0:A:h}"
COMPOSITES_DIR="$SCRIPT_DIR/composites"
AUDIO_DIR="$SCRIPT_DIR/audio"
MUSIC_DIR="$SCRIPT_DIR/music"
SEGMENTS_DIR="$SCRIPT_DIR/segments"
OUTPUT="$SCRIPT_DIR/privacy-bridge-demo.mp4"

mkdir -p "$SEGMENTS_DIR"
rm -f "$SEGMENTS_DIR"/*.mp4

VFADE_IN=0.2
AUDIO_DELAY=0.5
BREATH=0.3
VFADE_OUT=0.2
GAP=0.3

CLIPS=(01-landing 02-deposit 03-note 04-withdraw 05-dashboard 06-close)

for clip in "${CLIPS[@]}"; do
  COMPOSITE="$COMPOSITES_DIR/$clip.png"
  AUDIO="$AUDIO_DIR/$clip.mp3"
  SEG="$SEGMENTS_DIR/$clip.mp4"

  if [[ ! -f "$COMPOSITE" ]]; then echo "MISSING $COMPOSITE"; exit 1; fi
  if [[ ! -f "$AUDIO" ]]; then echo "MISSING $AUDIO"; exit 1; fi

  ADUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$AUDIO")
  ADUR=${ADUR%$'\r'}

  TOTAL=$(python3 -c "print(round($AUDIO_DELAY + $ADUR + $BREATH + $VFADE_OUT, 3))")
  FO_START=$(python3 -c "print(round($TOTAL - $VFADE_OUT, 3))")
  AFO_START=$(python3 -c "print(round($AUDIO_DELAY + $ADUR - 0.25, 3))")

  echo "Building $clip: audio=${ADUR}s total=${TOTAL}s"

  ffmpeg -y \
    -loop 1 -i "$COMPOSITE" \
    -i "$AUDIO" \
    -filter_complex "
      anullsrc=r=44100:cl=stereo,atrim=0:${AUDIO_DELAY}[silence];
      [silence][1:a]concat=n=2:v=0:a=1[joined];
      [joined]afade=t=in:st=${AUDIO_DELAY}:d=0.15,afade=t=out:st=${AFO_START}:d=0.25,apad=whole_dur=${TOTAL}[a];
      [0:v]scale=1920:1080,fade=t=in:st=0:d=${VFADE_IN},fade=t=out:st=${FO_START}:d=${VFADE_OUT}[v]
    " \
    -map "[v]" -map "[a]" \
    -t "$TOTAL" \
    -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -r 30 "$SEG" 2>/dev/null

  echo "OK $clip"
done

echo "Creating gap segment..."
ffmpeg -y -f lavfi -i "color=black:s=1920x1080:d=${GAP}" \
  -f lavfi -i "anullsrc=r=44100:cl=stereo" \
  -t "$GAP" \
  -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -r 30 "$SEGMENTS_DIR/gap.mp4" 2>/dev/null

CONCAT_FILE="$SEGMENTS_DIR/concat.txt"
rm -f "$CONCAT_FILE"
for clip in "${CLIPS[@]}"; do
  echo "file '$clip.mp4'" >> "$CONCAT_FILE"
  echo "file 'gap.mp4'" >> "$CONCAT_FILE"
done
sed -i '' '$ d' "$CONCAT_FILE"

echo "Concatenating segments..."
ffmpeg -y -f concat -safe 0 -i "$CONCAT_FILE" \
  -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -r 30 "$SEGMENTS_DIR/no-music.mp4" 2>/dev/null

VDUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$SEGMENTS_DIR/no-music.mp4")

BG_MUSIC="$MUSIC_DIR/bg.m4a"
if [[ -f "$BG_MUSIC" ]]; then
  echo "Mixing background music..."
  ffmpeg -y \
    -i "$SEGMENTS_DIR/no-music.mp4" \
    -i "$BG_MUSIC" \
    -filter_complex "
      [1:a]volume=0.08,afade=t=in:d=2,afade=t=out:st=$(python3 -c "print(round($VDUR - 3, 1))"):d=3[music];
      [0:a]volume=1.5[voice];
      [voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]
    " \
    -map 0:v -map "[aout]" \
    -c:v copy \
    -c:a aac -b:a 128k \
    "$OUTPUT" 2>/dev/null
  echo "Music mixed"
else
  echo "No background music, using voice-only"
  cp "$SEGMENTS_DIR/no-music.mp4" "$OUTPUT"
fi

DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT")
SIZE=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "DONE: $OUTPUT"
echo "Duration: ${DURATION}s"
echo "Size: $SIZE"
