# Privacy Bridge — Progress

## Last Session Summary
- **Date:** 2026-03-30
- **What was done:**
  - Increased font sizes across ALL pages (9 files, every sub-13px text bumped)
  - Fixed TypeScript strict-mode errors (implicit any in callbacks)
  - Removed `ignoreBuildErrors` — build passes clean with strict checking
  - Removed accidental `@next/swc-darwin-arm64` from package.json
  - Deployed to GitHub Pages, verified visually
- **What's next:**
  1. Demo video (highest impact for judges)
  2. Hackathon submission form (need platform URL)
  3. Tweet/social announcement
- **Blockers:** Need hackathon submission platform URL to proceed.

## Handover Notes
- Latest commit: `ba7b6df` "Fix TypeScript strict-mode errors, remove ignoreBuildErrors"
- origin/main is up to date
- GitHub Pages live at yonkoo11.github.io/privacy-bridge
- Build takes ~5-7 minutes on this machine, must run in background
- Build command: `cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build > /tmp/next-build.log 2>&1 &`
- The pino-pretty warning during build is non-fatal (comes from @walletconnect)
- SWC binary may need reinstall if `rm -rf node_modules` is run: `npm install @next/swc-darwin-arm64@14.2.33`

---

## Status: Phase 1-2 Complete, Phase 1A Verified on Devnet (27/27 tests)

### Phase 1A: Shielded ERC20 Token (pFLOW) — VERIFIED
- `contracts/starknet/src/shielded_token.cairo` — SNIP-2 ERC20, mint/burn restricted to bridge
- `contracts/starknet/src/bridge.cairo` — uses ERC20 instead of internal balances
- `scripts/deploy-devnet.mjs` — deploys ERC20 + bridge + sets token address
- `tests/e2e-devnet.test.mjs` — 27/27 passing on devnet

### Phase 1B-D: Services — VERIFIED (relayer e2e passing)
- `services/watcher/index.mjs` — syntax OK, needs Flow EVM events to test
- `services/relayer/index.mjs` — POST /relay e2e test: 3/3 passing
- `services/calldata/index.mjs` — starts, processes real proofs, returns 1977 felts

### Phase 2: Web App — VERIFIED (builds, deployed, font fixes applied)
- `app/` — Next.js 14 + wagmi + tailwind, 20 source files
- Production build clean (8/8 static pages, 0 TS errors)
- GitHub Pages live at yonkoo11.github.io/privacy-bridge
- OG meta tags + Twitter card + og.png for social sharing
- All font sizes bumped for readability (minimum 12px for mono, 15px for body)

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
- [ ] Watcher against real Flow EVM events (tested relay logic, not event polling)
- [ ] Browser snarkjs proof generation in actual browser (5.9MB zkey fetch)
- [ ] Note encryption/decryption in actual browser (tested with Node.js crypto.subtle)
- [ ] Storacha receipt upload end-to-end (needs W3UP_EMAIL + authorized w3up space)

### Architecture
- Deploy ordering: bridge(token=0x0) -> token(bridge) -> set_token_address (one-time, current=0x0 guard)
- SDK prover already had clean browser/server split, no changes needed
- Services share project root node_modules
- Storacha in relayer is best-effort: relay succeeds even if upload fails

### Known Limitations
- Root relay centralized (watcher uses owner key)
- Garaga calldata proxy centralized (can only cause tx failure, not theft)
- Emergency withdraw is single-key rug vector (mitigated by 30-day timelock)
- known_roots unbounded on Starknet (intentional: pruning locks funds)
- 1-party trusted setup
- Anonymity set starts at 0 (dashboard warns users)
