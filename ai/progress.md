# Privacy Bridge -- Progress

## Last Session Summary
- **Date:** 2026-03-31
- **What was done:**
  - Security audit identified 9 issues, fixed 7 that were fixable without circuit recompile
  - Fixed privacy leak: removed `amount` from Starknet ShieldedMint event
  - Fixed field element generation: explicit `% FIELD_PRIME` on random values
  - Fixed ABI mismatches: CommitmentLocked (not Deposit), nextLeafIndex (not nextIndex), commitmentExists (not commitments)
  - Fixed CommitmentLocked event: emits leafIndex instead of useless address(0)
  - Added CORS headers + OPTIONS preflight to relayer and calldata services
  - Fixed rate limiter: uses socket IP instead of spoofable x-forwarded-for
  - Moved storachaClient declaration above usage
  - SDK lockTokens extracts leafIndex from event instead of extra RPC call
  - SDK fetchAllCommitments sorts by leafIndex for correct tree order
  - Updated landing page + README with honest trust model documentation
  - All font sizes bumped for readability (previous session)
  - Build passes clean: 8/8 pages, 0 TS errors
- **What's next:**
  1. Demo video (highest impact for judges)
  2. Hackathon submission form (need platform URL)
- **Blockers:** Need hackathon submission platform URL.

## Handover Notes
- Latest commit: `2b1daf6` on main
- GitHub Pages live at yonkoo11.github.io/privacy-bridge
- Build: `cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build` (~5-7 min)
- SWC binary note: if `rm -rf node_modules`, run `npm install @next/swc-darwin-arm64@14.2.33`

---

## Issues Fixed This Session

| Issue | Fix | File(s) |
|-------|-----|---------|
| Amount in ShieldedMint event | Removed from struct | bridge.cairo |
| randomBigInt no field reduction | `% FIELD_PRIME` | useDeposit.ts, tests |
| Frontend ABI wrong event name | CommitmentLocked | constants.ts, WithdrawForm.tsx |
| Frontend ABI wrong function names | nextLeafIndex, commitmentExists | constants.ts, WithdrawForm.tsx |
| CommitmentLocked emitted address(0) | Now emits leafIndex | PrivacyBridge.sol |
| Missing CORS headers | Added to relayer + calldata | relayer/index.mjs, calldata/index.mjs |
| Rate limiter x-forwarded-for bypass | Use socket IP only | relayer/index.mjs |
| SDK ignores leafIndex from event | Extract from receipt | sdk/flow.mjs |
| Inaccurate trust model docs | Honest limitations | page.tsx, README.md |

## Issues NOT Fixed (require circuit recompile or architectural change)

| Issue | Why Not Fixed |
|-------|---------------|
| Amount as public circuit input | Requires circuit recompile + new trusted setup |
| 1-party trusted setup | Requires MPC ceremony (100+ participants) |
| One-directional bridge (no pFLOW redemption) | Architectural -- needs burn/unlock mechanism |
| Centralized root relay | Needs light client or cross-chain messaging |
| Emergency withdraw rug vector | Needs governance/multisig |

## Status: Phase 1-2 Complete

### Test Suites (93/93 total)
- [x] Circuit: 3/3
- [x] E2E devnet: 27/27
- [x] Storacha: 9/9
- [x] Encryption: 15/15
- [x] Withdraw flow: 17/17
- [x] Watcher unit: 12/12
- [x] Browser merkle: 7/7
- [x] Relayer e2e: 3/3

### What Has NOT Been Verified
- [ ] Full deposit-to-withdraw flow through web app (needs MetaMask + Flow testnet)
- [ ] Watcher against real Flow EVM events
- [ ] Browser snarkjs proof generation (5.9MB zkey fetch)
- [ ] Note encryption/decryption in actual browser
- [ ] Storacha receipt upload end-to-end
