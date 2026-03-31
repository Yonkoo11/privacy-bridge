# Privacy Bridge -- Progress

## Last Session Summary
- **Date:** 2026-03-31
- **What was done:**
  - Security audit: 9 issues found, 7 fixed
  - Fixed: privacy leak (amount in event), field element generation, ABI mismatches,
    CORS, rate limiter bypass, SDK event handling
  - Ran full 93/93 test suite on fresh devnet -- all passing
  - Rebuilt and redeployed to GitHub Pages with updated limitations
- **What's next:**
  1. Demo video
  2. Hackathon submission (need platform URL)
- **Blockers:** Need hackathon submission platform URL.

## Handover Notes
- Latest commit: `94fd8b2` on main
- GitHub Pages: yonkoo11.github.io/privacy-bridge (deploy in progress)
- Build: `cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build` (~6 min)
- Tests: `npm install` at root, then `node tests/<file>.mjs`
- Full e2e requires: devnet (`starknet-devnet --seed 42`), rpc-proxy, calldata service, relayer

---

## Test Results (verified 2026-03-31, fresh devnet)

| Suite | Count | Status |
|-------|-------|--------|
| Circuit | 3/3 | PASS |
| E2E devnet | 27/27 | PASS |
| Storacha | 9/9 | PASS |
| Encryption | 15/15 | PASS |
| Withdraw flow | 17/17 | PASS |
| Watcher unit | 12/12 | PASS |
| Browser merkle | 7/7 | PASS |
| Relayer e2e | 3/3 | PASS |
| **Total** | **93/93** | **ALL PASS** |

## Issues Fixed

| Issue | Fix | File(s) |
|-------|-----|---------|
| Amount in ShieldedMint event | Removed from struct | bridge.cairo |
| randomBigInt no field reduction | `% FIELD_PRIME` | useDeposit.ts, tests |
| Frontend ABI wrong event/function names | Aligned to contract | constants.ts, WithdrawForm.tsx |
| CommitmentLocked emitted address(0) | Now emits leafIndex | PrivacyBridge.sol |
| Missing CORS headers | Added to both services | relayer, calldata |
| Rate limiter x-forwarded-for bypass | Socket IP only | relayer |
| SDK ignores leafIndex from event | Extract from receipt | sdk/flow.mjs |
| Relayer e2e missing fee setup | Added set_relayer_fee | relayer-e2e.mjs |
| Trust model docs inaccurate | Honest limitations | page.tsx, README.md |

## Issues NOT Fixed (architectural)

| Issue | Why |
|-------|-----|
| Amount as public circuit input | Circuit recompile + new ceremony |
| 1-party trusted setup | Needs MPC ceremony |
| One-directional bridge | Needs burn/unlock mechanism |
| Centralized root relay | Needs light client |
| Emergency withdraw rug vector | Needs governance/multisig |
