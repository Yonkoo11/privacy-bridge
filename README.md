# Privacy Bridge

Cross-chain bridge with cryptographic privacy. Lock tokens on Flow EVM, generate a Groth16 ZK proof off-chain, and claim a shielded balance on Starknet. No link between source and destination.

## How It Works

1. **Lock** -- Deposit FLOW tokens into a fixed-denomination pool on Flow EVM. The contract computes an on-chain Poseidon Merkle tree root. Your commitment hides secret, nullifier, and amount.

2. **Prove** -- Off-chain, fetch all commitments and rebuild the Merkle tree. Generate a Groth16 proof that you know a valid leaf without revealing which one.

3. **Mint** -- Submit the proof to the Starknet bridge contract. The garaga verifier checks the Groth16 proof on-chain. If valid, your shielded balance is credited and the nullifier is marked spent. A relayer can submit proofs on your behalf for a fee.

## Architecture

```
Flow EVM                          Off-chain                         Starknet
---------                         ---------                         --------
PrivacyBridge.sol                 SDK (Node.js)                     PrivacyBridge (Cairo)
  lock(commitment)  ---------->  snarkjs Groth16 proof  ---------->  garaga verifier
  on-chain Poseidon               merkle tree                       nullifier tracking
  Merkle tree                     garaga calldata gen               shielded balances
  fixed denominations                                               relayer fees
  emergency withdraw                                                withdrawal timelock
```

**ZK Circuit** -- Circom, 6634 constraints, depth-24 Merkle tree, 4 public inputs (root, nullifierHash, recipient, amount). Private inputs: secret, nullifier, Merkle path.

**On-chain verification** -- garaga 1.0.1 Groth16 verifier on Starknet. ~1977 felts of calldata including MSM hints and pairing check data.

## Privacy Properties

- **Fixed denomination pools** -- All deposits in a pool have the same amount (0.0001, 0.001, 0.01, or 0.1 FLOW). Eliminates amount-based transaction linking.
- **Commitment hiding** -- On-chain commitment is Poseidon(Poseidon(secret, nullifier), amount). Observer cannot extract secret, nullifier, or link to withdrawal.
- **Nullifier binding** -- Each deposit has a unique nullifier. Double-spend is prevented on-chain.
- **No privacy-leaking events** -- Mint events emit only the nullifier hash and amount. No recipient, no Storacha CID, no off-chain identifiers.
- **On-chain Merkle tree** -- Poseidon incremental tree on Flow EVM. Root history stored on Starknet for trustless verification.
- **Relayer support** -- Anyone can submit proofs on behalf of users. Relayer earns a configurable fee (max 5%). Users don't need to reveal their Starknet address to the sequencer.
- **Withdrawal timelock** -- Configurable delay between deposit and withdrawal prevents timing correlation attacks.

## Project Structure

```
circuits/           Circom circuit + trusted setup artifacts
contracts/
  flow/             PrivacyBridge.sol + PoseidonT3.sol (EVM lock + Merkle tree)
  starknet/         Cairo bridge + garaga verifier
sdk/src/
  poseidon.mjs      Poseidon hash (BN254 field)
  merkle.mjs        Depth-24 Merkle tree
  prover.mjs        snarkjs proof + garaga calldata generation
  flow.mjs          Flow EVM client (with denomination validation)
  storacha.mjs      IPFS receipt upload
scripts/
  bridge.mjs        CLI: lock / prove / mint
  deploy-devnet.mjs Starknet devnet deployment (ECIP + verifier + bridge)
  deploy-flow.mjs   Flow EVM deployment (PoseidonT3 + PrivacyBridge)
  rpc-proxy.mjs     RPC compatibility proxy for devnet
tests/
  circuit.test.mjs  Circuit constraint tests (3/3)
  e2e-devnet.test.mjs  Full pipeline test on devnet (16/16)
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
# Lock tokens on Flow EVM (must use allowed denomination: 0.0001, 0.001, 0.01, or 0.1)
FLOW_PRIVATE_KEY=0x... node scripts/bridge.mjs lock --amount 0.01 --contract 0x...

# Generate ZK proof
node scripts/bridge.mjs prove --note note-0.json --recipient 0x...

# Submit proof to Starknet
node scripts/bridge.mjs mint --proof proof-0.json
```

## Safety Mechanisms

- **Emergency withdraw** -- Contract owner can initiate an emergency withdrawal with a 30-day timelock. Can be cancelled during the delay period. Protects locked funds if the bridge is compromised.
- **Denomination control** -- Owner can add/remove denominations via `set_denomination()`.
- **Relayer fee cap** -- Maximum 5% (500 bps), set by owner.

## Known Limitations

- **1-party trusted setup** -- Local Powers of Tau ceremony. Not suitable for production without an MPC ceremony.
- **BN254 curve** -- Not quantum resistant. Future version could use STARK proofs.
- **Anonymity set = pool size** -- With few deposits, timing analysis can narrow the anonymity set. Privacy improves with more users.
- **Root relay still centralized** -- On-chain tree on Flow is trustlessly verifiable, but relay to Starknet still requires owner. Future: use a cross-chain messaging protocol.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| ZK Circuit | Circom 2.1.9 + snarkjs (Groth16/BN254) |
| Source Chain | Flow EVM (Solidity 0.8.20) |
| Destination Chain | Starknet (Cairo 2.14.0) |
| On-chain Verifier | garaga 1.0.1 |
| Hash Function | Poseidon (BN254 scalar field) |
| On-chain Merkle | poseidon-solidity (BN254 constants) |
| Storage | Storacha (w3up-client) |

## License

MIT
