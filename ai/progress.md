# Privacy Bridge — Progress

## Status: Submission-ready (minus demo video)

### DONE
- [x] Circuit: bridge.circom (6634 constraints, 4 public inputs, depth 24)
- [x] Trusted setup: Hermez Phase 1 ptau + Groth16 setup complete
- [x] Circuit tests: 3/3 passing
- [x] Solidity: PrivacyBridge.sol (lock contract for Flow EVM) — compiles with forge
- [x] SDK: poseidon.mjs, merkle.mjs, prover.mjs, flow.mjs, storacha.mjs
- [x] CLI: scripts/bridge.mjs (lock + prove + mint commands)
- [x] garaga verifier generated (groth16_verifier.cairo + 79KB constants)
- [x] Cairo bridge contract: contracts/starknet/src/bridge.cairo
- [x] Cairo build: scarb 2.14.0 passes clean
- [x] Devnet deployment script: deploy-devnet.mjs (ECIP + verifier + bridge, automated)
- [x] Flow EVM deploy script: deploy-flow.mjs (forge compile + ethers deploy)
- [x] E2E devnet test: 8/8 passing (full proof verification on-chain)
- [x] Storacha test: 9/9 passing (unit tests, upload skipped without space)
- [x] Bug fix: garaga calldata length prefix stripping
- [x] README: full documentation
- [x] Landing page: docs/index.html
- [x] package.json scripts updated
- [x] .gitignore covers all sensitive files

### NOT DONE
- [ ] Deploy PrivacyBridge.sol to Flow EVM testnet (needs funded wallet)
- [ ] Demo video (3 min max)
- [ ] Git commit

### KEY FILES
- contracts/starknet/src/bridge.cairo — Cairo bridge with garaga verification
- contracts/flow/PrivacyBridge.sol — EVM lock contract
- sdk/src/prover.mjs — snarkjs proof + garaga calldata (with length prefix fix)
- scripts/deploy-devnet.mjs — full devnet deployment (ECIP + verifier + bridge)
- tests/e2e-devnet.test.mjs — 8-phase end-to-end test
- docs/index.html — landing page

### DEVNET STATE
- starknet-devnet --seed 42 on :5050
- rpc-proxy on :5051
- ECIP ops class declared separately (now automated in deploy-devnet.mjs)
