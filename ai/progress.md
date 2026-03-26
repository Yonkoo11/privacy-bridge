# Privacy Bridge — Progress

## Status: 7 Privacy Fixes + Self-Review Fixes (20/20 E2E tests passing on devnet)

### DONE
- [x] Circuit: bridge.circom (6634 constraints, 4 public inputs, depth 24)
- [x] Trusted setup: Hermez Phase 1 ptau + Groth16 setup complete
- [x] Circuit tests: 3/3 passing
- [x] Solidity: PrivacyBridge.sol (lock + on-chain Merkle tree + denominations + emergency)
- [x] PoseidonT3.sol wrapper (poseidon-solidity npm package)
- [x] SDK: poseidon.mjs, merkle.mjs, prover.mjs, flow.mjs, storacha.mjs
- [x] CLI: scripts/bridge.mjs (lock + prove + mint commands)
- [x] garaga verifier generated (groth16_verifier.cairo + 79KB constants)
- [x] Cairo bridge contract with all 7 fixes + self-review fixes
- [x] E2E devnet test: 20/20 passing (11 phases)
- [x] README.md and docs/index.html updated

### 7 PRIVACY FIXES + SELF-REVIEW
1. **Fix 4**: Remove storacha_cid from mint() and ShieldedMint event
2. **Fix 1**: Fixed denomination pools (0.0001, 0.001, 0.01, 0.1) on Solidity. Removed from Cairo (denomination disable after deposit would lock funds)
3. **Fix 3**: On-chain Merkle tree (Poseidon, depth 24, root ring buffer of 30) + known_roots on Starknet
4. **Fix 7**: Emergency withdraw with 30-day timelock (Solidity)
5. **Fix 2**: Shielded balance tracking. Transfer event emits only amount (NOT from/to — that would destroy privacy)
6. **Fix 5**: Relayer fee with max_fee_bps protection (user bounds the fee at submission time)
7. **Fix 6**: Withdrawal time lock (root_timestamps + min_withdrawal_delay)

### Self-review bugs found and fixed
- Transfer event was emitting from/to/amount — now emits only amount (privacy fix)
- Denomination check on Starknet removed — disable after deposit would lock funds
- Added max_fee_bps parameter to mint() — protects users from fee changes between proof gen and submission
- known_roots unbounded on Starknet is INTENTIONAL: pruning would lock funds for users with stale roots

### VERIFIED ON DEVNET (20/20)
- [x] Mint without storacha_cid (Fix 4)
- [x] Allowed denomination accepted, balance credited (Fix 1 + Fix 2)
- [x] Root stored in known_roots, verified by mint (Fix 3)
- [x] u256 → ContractAddress conversion works (Fix 2)
- [x] Double-spend rejected
- [x] Multi-deposit anonymity set (3 deposits, withdraw middle)
- [x] Cumulative balance correct across multiple mints
- [x] Relayer fee deduction: recipient got 0.099, relayer got 0.001 on 0.1 deposit with 1% fee (Fix 5)
- [x] max_fee_bps rejection: fee=200bps, max=50bps → reverted (Fix 5)
- [x] Poseidon zero values match between JS SDK and poseidon-solidity

### DEPLOYED TO FLOW EVM TESTNET
- PoseidonT3 library: 0xa49dF7B02806B4661d2D7064fE857af9BDc9a82a
- PoseidonT3Wrapper: 0x2eaEF8016D2a7Dc01677E57183a167649cB07402
- PrivacyBridge: 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca
- Verified on-chain: denominations, owner, ZEROS[0] match JS, empty tree root correct
- **On-chain Merkle root matches JS SDK after real deposit** (the critical cross-chain test)
- 1 real deposit on testnet (0.001 FLOW, TX 0x782b831c...)

### NOT DONE
- [ ] Demo video (3 min max)

### HONESTLY UNTESTED
- Emergency withdraw flow (compile-verified, not exercised)
- Withdrawal timelock with delay > 0 (needs devnet `increase_time` RPC)

### KNOWN LIMITATIONS (documented, not fixable in scope)
- Root relay is still centralized (owner relays from Flow to Starknet)
- Emergency withdraw is a single-key rug vector (mitigated by 30-day timelock)
- known_roots on Starknet grows unbounded (intentional: pruning locks funds)
- 1-party trusted setup
