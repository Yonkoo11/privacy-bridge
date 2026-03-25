# Privacy Bridge — Progress

## Status: Day 1 Build

### DONE
- [x] Repo created at ~/Projects/privacy-bridge/
- [x] Circuit: bridge.circom (6634 constraints, 4 public inputs, depth 24)
- [x] Trusted setup: Hermez Phase 1 ptau + Groth16 setup complete
- [x] Circuit tests: 3/3 passing (single deposit, multi-deposit, wrong-secret rejection)
- [x] Solidity: PrivacyBridge.sol (lock contract for Flow EVM)
- [x] SDK: poseidon.mjs, merkle.mjs, prover.mjs, flow.mjs, storacha.mjs
- [x] CLI: scripts/bridge.mjs (lock + prove commands)
- [x] Reusable code copied from Cipher Pol (circomlib, hash.circom, rpc-proxy)
- [x] Calendar deadline: April 1, 2026 with 3-day reminder

### IN PROGRESS
- [ ] Deploy PrivacyBridge.sol to Flow EVM testnet
- [ ] Starknet Cairo mint contract with garaga verifier
- [ ] Storacha w3up-client integration test
- [ ] End-to-end test: lock on Flow → prove → mint on Starknet

### NOT DONE
- [ ] garaga calldata generation for bridge circuit
- [ ] Landing page (docs/index.html)
- [ ] Demo video
- [ ] README for submission

### KEY DECISIONS
- 4 public inputs (root, nullifierHash, recipient, amount) — simpler than Cipher Pol's 7
- No association set (not needed for bridge use case)
- No partial withdrawals (amount must match deposit exactly)
- Native FLOW only (no ERC20 for demo simplicity)

### UNKNOWNS VALIDATED
- Flow EVM testnet: RPC live at https://testnet.evm.nodes.onflow.org, chain ID 545
- Storacha: Free tier 5GB, no capacity credit issues, @web3-storage/w3up-client@17.3.0
- Flow faucet: https://faucet.flow.com/fund-account + ETHGlobal faucet
- NOT YET VALIDATED: actual deploy to Flow EVM, Storacha upload, garaga calldata format
