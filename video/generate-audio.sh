#!/usr/bin/env zsh
setopt +o nomatch
set -e

SCRIPT_DIR="${0:A:h}"
AUDIO_DIR="$SCRIPT_DIR/audio"
mkdir -p "$AUDIO_DIR"
rm -f "$AUDIO_DIR"/*.mp3

VOICE_ID="nPczCjzI2devNBz1zQrb"  # Brian
MODEL="eleven_multilingual_v2"

if [[ -z "$ELEVENLABS_API_KEY" ]]; then
  echo "ERROR: ELEVENLABS_API_KEY not set"
  exit 1
fi

declare -A CLIPS
CLIPS[01-landing]="This is Privacy Bridge. You deposit tokens on any of six E-V-M chains. You withdraw on Starknet. There is no on-chain link between the two transactions. The chain map at the top shows all six source networks pointing to a single Starknet destination."
CLIPS[02-deposit]="On the deposit side, you pick a fixed denomination and lock tokens into the bridge contract. The pool size counter reads from the chain in real time so you can see how many other deposits are in the set. More deposits means better privacy."
CLIPS[03-note]="After locking, you get a secret note. This note is the only way to withdraw later. You have to check the backup confirmation before the app lets you proceed. Lose the note, lose the funds. That is by design."
CLIPS[04-withdraw]="Withdrawal is one click. You paste the note, enter a Starknet address, and hit Declassify. The app builds a Groth-sixteen proof, fetches the garaga calldata, and relays to Starknet automatically. Each step shows elapsed time so you know what is happening."
CLIPS[05-dashboard]="The dashboard pulls deposit counts and the latest Merkle root directly from the bridge contract on whichever chain you are connected to. Five chains are live right now with identical contracts deployed on each one."
CLIPS[06-close]="Six source chains. One Starknet destination. Zero link between deposit and withdrawal. That is Privacy Bridge."

for clip in 01-landing 02-deposit 03-note 04-withdraw 05-dashboard 06-close; do
  OUT="$AUDIO_DIR/$clip.mp3"
  echo "Generating $clip..."
  TEXT="${CLIPS[$clip]}"

  curl -s "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"$TEXT\",
      \"model_id\": \"$MODEL\",
      \"voice_settings\": {
        \"stability\": 0.82,
        \"similarity_boost\": 0.65,
        \"style\": 0.03
      }
    }" \
    -o "$OUT"

  if file "$OUT" | grep -q "JSON\|text\|ASCII"; then
    echo "ERROR: $clip returned error:"
    cat "$OUT"
    rm "$OUT"
    exit 1
  fi

  SIZE=$(wc -c < "$OUT")
  echo "OK $clip ($SIZE bytes)"
done

echo "All audio clips generated"
