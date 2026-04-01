# Privacy Bridge

Multichain ZK privacy bridge. Lock tokens on any supported EVM chain, generate a Groth16 proof off-chain, and claim shielded tokens on Starknet. No link between source and destination.

**Supported source chains:** Flow EVM, Ethereum, Base, Arbitrum, Polygon, Optimism

**Live Demo:** [yonkoo11.github.io/privacy-bridge](https://yonkoo11.github.io/privacy-bridge)

## How It Works

1. **Lock** -- Deposit native tokens into a fixed-denomination pool on any supported EVM chain. The contract computes an on-chain Poseidon Merkle tree root. Your commitment hides secret, nullifier, and amount.

2. **Prove** -- Off-chain, fetch all commitments from the source chain and rebuild the Merkle tree. Generate a Groth16 proof that you know a valid leaf without revealing which one.

3. **Mint** -- Submit the proof to the Starknet bridge contract for that source chain. The garaga verifier checks the Groth16 proof on-chain. If valid, shielded tokens (SNIP-2 ERC20) are minted to the recipient and the nullifier is marked spent. A relayer can submit proofs on your behalf for a fee.

## Architecture

```
Any EVM Source Chain              Off-chain                         Starknet
--------------------              ---------                         --------
PrivacyBridge.sol                 SDK (Node.js)                     PrivacyBridge (Cairo)
  lock(commitment)  ---------->  snarkjs Groth16 proof  ---------->  garaga verifier
  on-chain Poseidon               merkle tree                       nullifier tracking
  Merkle tree                     garaga calldata gen               shielded ERC20 mint
  fixed denominations                                               relayer fees
  emergency withdraw                                                withdrawal timelock

Supported: Flow EVM | Ethereum | Base | Arbitrum | Polygon | Optimism
Each source chain gets its own bridge+token pair on Starknet.
Same circuit, same verifier, separate anonymity pools per chain.
```

**ZK Circuit** -- Circom, 6634 constraints, depth-24 Merkle tree, 4 public inputs (root, nullifierHash, recipient, amount). Private inputs: secret, nullifier, Merkle path.

**On-chain verification** -- garaga 1.0.1 Groth16 verifier on Starknet. ~1977 felts of calldata including MSM hints and pairing check data.

## Privacy Properties

- **Fixed denomination pools** -- All deposits in a pool have the same amount (0.0001, 0.001, 0.01, or 0.1 FLOW). Eliminates amount-based transaction linking.
- **Commitment hiding** -- On-chain commitment is Poseidon(Poseidon(secret, nullifier), amount). Observer cannot extract secret, nullifier, or link to withdrawal.
- **Nullifier binding** -- Each deposit has a unique nullifier. Double-spend is prevented on-chain.
- **Minimal event exposure** -- Mint events emit only the nullifier hash. No recipient, no amount, no Storacha CID, no off-chain identifiers.
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
services/
  watcher/          Root relay watcher (Flow EVM -> Starknet)
  relayer/          Gasless withdrawal relayer (HTTP API + Storacha receipts)
  calldata/         Garaga calldata proxy (Python subprocess wrapper)
app/                Next.js 14 web app (wagmi + tailwind)
scripts/
  bridge.mjs        CLI: lock / prove / mint
  deploy-devnet.mjs Starknet devnet deployment (ECIP + verifier + bridge + ERC20)
  deploy-flow.mjs   Flow EVM deployment (PoseidonT3 + PrivacyBridge)
  rpc-proxy.mjs     RPC compatibility proxy for devnet
tests/
  circuit.test.mjs         Circuit constraint tests (3/3)
  e2e-devnet.test.mjs      Full pipeline on devnet (27/27)
  storacha.test.mjs        Storacha integration test (9/9)
  encryption.test.mjs      AES-256-GCM note encryption (15/15)
  withdraw-flow.test.mjs   Full withdraw flow e2e (17/17)
  watcher-unit.test.mjs    Watcher unit tests (12/12)
  merkle-browser.test.mjs  Browser merkle cross-check (7/7)
  relayer-e2e.mjs          Relayer POST /relay e2e (3/3)
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

### Deploy to New Chain

```bash
DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-evm.mjs --chain sepolia
DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-evm.mjs --chain base-sepolia
# Supported: flow-evm-testnet, sepolia, base-sepolia, arbitrum-sepolia, polygon-amoy, optimism-sepolia
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

## Deployed Contracts

### EVM Source Chains (PrivacyBridge.sol)

| Chain | Chain ID | Bridge Address |
|-------|----------|---------------|
| Flow EVM Testnet | 545 | `0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca` |
| Ethereum Sepolia | 11155111 | `0x2eaEF8016D2a7Dc01677E57183a167649cB07402` |
| Base Sepolia | 84532 | `0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca` |
| Arbitrum Sepolia | 421614 | `0x2eaEF8016D2a7Dc01677E57183a167649cB07402` |
| Optimism Sepolia | 11155420 | `0x2eaEF8016D2a7Dc01677E57183a167649cB07402` |
| Polygon Amoy | 80002 | Not deployed (insufficient testnet funds) |

Identical PrivacyBridge.sol deployed on each chain. Same ABI, same Poseidon Merkle tree, same denomination pools.

### Starknet Destination (devnet)

| Contract | Address |
|----------|---------|
| PrivacyBridge (Cairo) | `0x498a5db3d556c07881cdac008d07c48bc7c602d6987f7d30c8b13aae291342` |
| ShieldedToken (pFLOW) | `0x5e82efcc944d4548356f1da6b48b7a24dd607b3690cfce87ddd0e86c38195c8` |

Note: Starknet contracts are deployed on local devnet. The token constructor accepts name/symbol parameters for multichain deployment (pETH, pBASE, pARB, pOP). Additional bridge+token pairs for non-Flow source chains are pending deployment.

## Safety Mechanisms

- **Emergency withdraw** -- Contract owner can initiate an emergency withdrawal with a 30-day timelock. Can be cancelled during the delay period. Protects locked funds if the bridge is compromised.
- **Denomination control** -- Owner can add/remove denominations via `set_denomination()`.
- **Relayer fee cap** -- Maximum 5% (500 bps), set by owner.

## Known Limitations

- **1-party trusted setup** -- Local Powers of Tau ceremony. The ceremony operator can forge proofs. Production requires an MPC ceremony with 100+ participants.
- **One-directional bridge** -- pFLOW tokens on Starknet have no redemption path back to FLOW. This is a proof of concept, not a production bridge.
- **Root relay centralized** -- The watcher uses a single owner key. A malicious operator could relay a fake root containing fabricated commitments.
- **Emergency withdraw rug vector** -- Single key with 30-day timelock. Users must monitor EmergencyInitiated events to exit in time.
- **Amount as public input** -- While denomination pools enforce uniform sizes, the amount is visible as a circuit public signal on both chains. A production version should remove it.
- **Anonymity set = pool size** -- With few deposits, timing analysis can narrow the anonymity set. Privacy improves with more users.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| ZK Circuit | Circom 2.1.9 + snarkjs (Groth16/BN254) |
| Source Chains | Flow EVM, Ethereum, Base, Arbitrum, Optimism (Solidity 0.8.20) |
| Destination Chain | Starknet (Cairo 2.14.0) |
| On-chain Verifier | garaga 1.0.1 |
| Hash Function | Poseidon (BN254 scalar field) |
| On-chain Merkle | poseidon-solidity (BN254 constants) |
| Storage | Storacha (w3up-client) |

## Team

- [@soligxbt](https://x.com/soligxbt)

## License

MIT
