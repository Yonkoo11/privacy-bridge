#!/usr/bin/env zsh
set -e

SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR"

echo "=== PRIVACY BRIDGE DEMO VIDEO ==="
echo ""

echo "[1/4] Capturing frames from live site..."
node capture-frames.cjs

echo ""
echo "[2/4] Generating audio via ElevenLabs..."
zsh generate-audio.sh

echo ""
echo "[3/4] Compositing captions onto frames..."
python3 generate-captions.py

echo ""
echo "[4/4] Assembling final video..."
zsh assemble.sh

echo ""
echo "=== PIPELINE COMPLETE ==="
