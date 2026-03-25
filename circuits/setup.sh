#!/bin/bash
# Trusted setup for Privacy Bridge circuit
# Generates proving/verification keys using Hermez Phase 1 ptau.
#
# Requirements:
#   circom v2.x binary at ~/bin/circom (or on PATH)
#   npx snarkjs v0.7.x (from node_modules)
#
# Usage:
#   cd privacy-bridge && bash circuits/setup.sh

set -e

CIRCUITS_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$CIRCUITS_DIR/target"
CIRCUIT_CIRCOM="$CIRCUITS_DIR/bridge.circom"

mkdir -p "$TARGET_DIR"

# Step 1: Compile circuit
if [ ! -f "$TARGET_DIR/bridge.r1cs" ]; then
  echo "=== Step 1: Compile circuit ==="
  export PATH="$PATH:$HOME/bin"
  circom "$CIRCUIT_CIRCOM" --r1cs --wasm --sym -o "$TARGET_DIR" -l "$CIRCUITS_DIR"
  echo "r1cs: $TARGET_DIR/bridge.r1cs"
  echo "wasm: $TARGET_DIR/bridge_js/bridge.wasm"
else
  echo "=== Step 1: Skipped (bridge.r1cs exists) ==="
fi

# Step 2: Download Hermez Phase 1 final ptau (n=16, 65536 capacity)
PTAU_FILE="$TARGET_DIR/hermez_final_16.ptau"
if [ ! -f "$PTAU_FILE" ]; then
  echo "=== Step 2: Download Hermez Phase 1 ptau (72MB) ==="
  curl -fsSL "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau" \
    -o "$PTAU_FILE" --progress-bar
  echo "ptau: $PTAU_FILE"
else
  echo "=== Step 2: Skipped (hermez ptau exists) ==="
fi

# Step 3: Generate initial proving key
if [ ! -f "$TARGET_DIR/bridge_0000.zkey" ]; then
  echo "=== Step 3: Groth16 setup ==="
  npx snarkjs groth16 setup "$TARGET_DIR/bridge.r1cs" "$PTAU_FILE" "$TARGET_DIR/bridge_0000.zkey"
  echo "Initial zkey: $TARGET_DIR/bridge_0000.zkey"
else
  echo "=== Step 3: Skipped (bridge_0000.zkey exists) ==="
fi

# Step 4: Contribute entropy to proving key
if [ ! -f "$TARGET_DIR/bridge_final.zkey" ]; then
  echo "=== Step 4: Contribute to zkey ==="
  npx snarkjs zkey contribute "$TARGET_DIR/bridge_0000.zkey" "$TARGET_DIR/bridge_final.zkey" \
    --name="Privacy Bridge" -e="bridge-$(date +%s)"
  echo "Final zkey: $TARGET_DIR/bridge_final.zkey"
else
  echo "=== Step 4: Skipped (bridge_final.zkey exists) ==="
fi

# Step 5: Export verification key
if [ ! -f "$TARGET_DIR/verification_key.json" ]; then
  echo "=== Step 5: Export verification key ==="
  npx snarkjs zkey export verificationkey "$TARGET_DIR/bridge_final.zkey" "$TARGET_DIR/verification_key.json"
  echo "Verification key: $TARGET_DIR/verification_key.json"
else
  echo "=== Step 5: Skipped (verification_key.json exists) ==="
fi

echo ""
echo "=== DONE ==="
echo ""
echo "Artifacts:"
echo "  WASM:  $TARGET_DIR/bridge_js/bridge.wasm"
echo "  ZKEY:  $TARGET_DIR/bridge_final.zkey"
echo "  VKEY:  $TARGET_DIR/verification_key.json"
