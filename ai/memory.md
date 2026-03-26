# Privacy Bridge — Decisions & Architecture

## Architecture
- Flow EVM (Solidity lock) → Off-chain Groth16 proof → Starknet (Cairo mint + garaga verifier)
- Circuit: bridge.circom, 6634 constraints, depth 24 Merkle tree
- Commitment = Poseidon(Poseidon(secret, nullifier), amount)
- NullifierHash = Poseidon(nullifier, nullifier)
- 4 public inputs: root, nullifierHash, recipient, amount

## Key Lessons from Cipher Pol
- snarkjs proof coordinates are DECIMAL strings. Never prepend "0x".
- garaga calldata ~2918 felts. Test serialization early.
- starknet-devnet --seed 42 for reproducible addresses.
- RPC proxy needed for starknet.js compatibility.

## Hackathon Tracks (NO OVERLAP with Cipher Pol)
- Crypto, Flow, Storacha (3 tracks)
- Dropped: AI & Robotics (no AI code in project, dishonest to submit)
- Do NOT select: Fresh Code, Infrastructure, Starknet, Lit Protocol, Community Vote
