# Privacy Bridge

Cross-chain bridge with cryptographic privacy. Lock tokens on Flow EVM, generate a Groth16 ZK proof off-chain, and claim a shielded balance on Starknet. No link between source and destination.

## How It Works

1. **Lock** — Deposit FLOW tokens into the bridge contract on Flow EVM with a Poseidon commitment hash. The commitment hides your secret, nullifier, and amount.

2. **Prove** — Off-chain, build a Merkle tree from all on-chain commitments, generate a Groth16 proof that you know a valid commitment in the tree without revealing which one.

3. **Mint** — Submit the proof to the Starknet bridge contract. The garaga verifier checks the Groth16 proof on-chain. If valid, your shielded balance is minted and the nullifier is marked spent (no double claims).

4. **Store** — A receipt (commitment, nullifier hash, timestamps) is uploaded to IPFS via Storacha. The CID is recorded on-chain for auditability without revealing the link.

## Architecture

```
Flow EVM                          Off-chain                         Starknet
---------                         ---------                         --------
PrivacyBridge.sol                 SDK (Node.js)                     PrivacyBridge (Cairo)
  lock(commitment)  ─────────►  snarkjs Groth16 proof  ─────────►  garaga verifier
  stores commitment               merkle tree                       nullifier tracking
  in merkle tree                   garaga calldata gen               ShieldedMint event
                                   storacha receipt
```

**ZK Circuit** — Circom, 6634 constraints, depth-24 Merkle tree, 4 public inputs (root, nullifierHash, recipient, amount). Private inputs: secret, nullifier, Merkle path.

**On-chain verification** — garaga 1.0.1 Groth16 verifier on Starknet. ~1977 felts of calldata including MSM hints and pairing check data. Verification cost is dominated by the ECIP multi-scalar multiplication.

## Project Structure

```
circuits/           Circom circuit + trusted setup artifacts
contracts/
  flow/             PrivacyBridge.sol (EVM lock contract)
  starknet/         Cairo bridge + garaga verifier
sdk/src/
  poseidon.mjs      Poseidon hash (BN254 field)
  merkle.mjs        Depth-24 Merkle tree
  prover.mjs        snarkjs proof + garaga calldata generation
  flow.mjs          Flow EVM client
  storacha.mjs      IPFS receipt upload
scripts/
  bridge.mjs        CLI: lock / prove / mint
  deploy-devnet.mjs Starknet devnet deployment (ECIP + verifier + bridge)
  deploy-flow.mjs   Flow EVM testnet deployment
  rpc-proxy.mjs     RPC compatibility proxy for devnet
tests/
  circuit.test.mjs  Circuit constraint tests (3/3)
  e2e-devnet.test.mjs  Full pipeline test on devnet (8/8)
  storacha.test.mjs Storacha integration test (9/9)
```

## Quick Start

### Prerequisites

- Node.js 20+
- [scarb 2.14.0](https://docs.swmansion.com/scarb/) (Cairo compiler)
- [starkli](https://book.starkli.rs/) (Starknet CLI)
- [starknet-devnet](https://github.com/0xSpaceShard/starknet-devnet-rs) (local Starknet)
- Python 3.10 with `garaga==1.0.1` (`pip install garaga`)
- [Foundry](https://book.getfoundry.sh/) (for Solidity compilation)

### Install

```bash
npm install
```

### Run Tests (devnet)

```bash
# Terminal 1: start devnet
starknet-devnet --seed 42

# Terminal 2: start RPC proxy
node scripts/rpc-proxy.mjs

# Terminal 3: deploy and test
node scripts/deploy-devnet.mjs
node tests/e2e-devnet.test.mjs
```

### CLI Usage

```bash
# Lock tokens on Flow EVM
FLOW_PRIVATE_KEY=0x... node scripts/bridge.mjs lock --amount 0.01 --contract 0x...

# Generate ZK proof
node scripts/bridge.mjs prove --note note-0.json --recipient 0x...

# Submit proof to Starknet
node scripts/bridge.mjs mint --proof proof-0.json
```

## Privacy Properties

- **Commitment hiding** — On-chain commitment is Poseidon(Poseidon(secret, nullifier), amount). Observer cannot extract secret, nullifier, or link to withdrawal.
- **Nullifier binding** — Each deposit has a unique nullifier. Double-spend is prevented on-chain.
- **Amount hidden from events** — Lock events emit only the commitment hash, not the amount.
- **No on-chain link** — The ZK proof demonstrates knowledge of a valid commitment without revealing which one. Source address on Flow has no visible connection to recipient on Starknet.

## Known Limitations

- **1-party trusted setup** — Local Powers of Tau ceremony. Not suitable for production without an MPC ceremony.
- **BN254 curve** — Not quantum resistant. Future version could use STARK proofs.
- **Anonymity set = pool size** — With few deposits, timing analysis can narrow the anonymity set. Privacy improves with more users.
- **No relay** — The user submits their own proof on Starknet, revealing their Starknet address to the sequencer.
- **Storacha CID is a placeholder** — Receipt upload is implemented but not wired into the mint flow end-to-end.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| ZK Circuit | Circom 2.1.9 + snarkjs (Groth16/BN254) |
| Source Chain | Flow EVM (Solidity 0.8.20) |
| Destination Chain | Starknet (Cairo 2.14.0) |
| On-chain Verifier | garaga 1.0.1 |
| Hash Function | Poseidon (BN254 scalar field) |
| Storage | Storacha (w3up-client) |

## License

MIT
