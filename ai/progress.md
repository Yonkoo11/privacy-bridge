# Privacy Bridge — Progress

## Status: Phase 1-2 Complete, Phase 1A Verified on Devnet (27/27 tests)

### Phase 1A: Shielded ERC20 Token (pFLOW) — VERIFIED
- `contracts/starknet/src/shielded_token.cairo` — SNIP-2 ERC20, mint/burn restricted to bridge
- `contracts/starknet/src/bridge.cairo` — uses ERC20 instead of internal balances
  - `set_token_address()` one-time setter for deploy ordering
- `scripts/deploy-devnet.mjs` — deploys ERC20 + bridge + sets token address
- `tests/e2e-devnet.test.mjs` — 27/27 passing on devnet
  - All original tests pass with ERC20 balances
  - New: total_supply check, ERC20 transfer, metadata (name/symbol/decimals)
  - Relayer fee via ERC20 mint (recipient 0.099, relayer 0.001 on 0.1 with 1%)

### Phase 1B-D: Services — VERIFIED (relayer e2e passing)
- `services/watcher/index.mjs` — syntax OK, needs Flow EVM events to test
- `services/relayer/index.mjs` — POST /relay e2e test: 3/3 passing (proof→calldata→relay→on-chain verify)
  - Fixed: Account constructor needed `'1', constants.TRANSACTION_VERSION.V3` for devnet V3 txs
  - Fixed: u256 `max_fee_bps` low/high must be strings, not raw BigInts
- `services/calldata/index.mjs` — starts, processes real proofs, returns 1977 felts

### Phase 2: Web App — VERIFIED (builds, serves, types clean)
- `app/` — Next.js 14 + wagmi + tailwind, 20 source files
- `next build` clean, all 6 routes static
- Dev server serves landing page correctly
- Circuit artifacts (bridge.wasm 1.7MB, bridge_final.zkey 5.9MB, verification_key.json 3.4K) copied to public/
- NoteData type unified across hooks and encryption module

### What Has Been Verified
- [x] Cairo compiles (scarb build clean)
- [x] Devnet deploy: ECIP + verifier + bridge + token, set_token_address
- [x] 27/27 e2e tests pass: mint via ERC20, balances, transfer, double-spend, relayer fee, max_fee_bps
- [x] Calldata proxy: real proof in, 1977 felts out, via HTTP
- [x] Relayer: health + fee endpoints respond correctly
- [x] Relayer POST /relay: full e2e (proof → calldata proxy → relay → on-chain mint → balance verify), 3/3 pass
- [x] Next.js: builds clean, serves landing page

### What Has Been Verified (This Session)
- [x] Note encryption/decryption: 15/15 tests (AES-256-GCM round-trip, wrong password, tamper detection, large field elements)
- [x] Full withdraw flow e2e: 17/17 tests (note gen → proof → calldata proxy HTTP → relayer HTTP → on-chain verify → double-spend reject)
- [x] Watcher unit tests: 12/12 (state persistence, u256 split, relay simulation on devnet, entrypoint alignment)
- [x] Browser merkle tree cross-check: 7/7 (matches SDK for 1, 3, and 10 commitments)
- [x] Fixed: watcher had same Account V3 + u256 string bugs as relayer
- [x] Fixed: useWithdraw.ts — calldata type (string→string[]), missing max_fee_bps, stale witness field
- [x] Fixed: WithdrawForm.tsx — replaced placeholder merkle proof with real on-chain commitment fetching
- [x] Created: app/src/lib/merkle.ts — browser-side Poseidon merkle tree (matches SDK exactly)
- [x] App builds clean after all fixes (8/8 static pages)

### Submission Readiness Fixes (This Session)
- [x] Created LICENSE (MIT)
- [x] Wired Storacha uploadReceipt() into relayer — best-effort IPFS receipt after mint, CID in response
- [x] Dropped AI & Robotics track (no AI code, dishonest to submit) — 3 tracks: Crypto, Flow, Storacha
- [x] Updated README: correct test counts (27/27 e2e + 5 more suites), team handle (@soligxbt), services + app in structure
- [x] Added GitHub Pages workflow (.github/workflows/deploy.yml)
- [x] Added output: 'export' to next.config.mjs for static deploy
- [x] Relayer syntax check passes after Storacha integration

### What Has Been Verified (Submission Readiness)
- [x] Next.js builds clean with `output: 'export'` — 6 HTML pages in `out/` (index, bridge, deposit, withdraw, notes, 404)
- [x] Storacha import resolves from relayer path — createReceipt produces valid receipt JSON
- [x] Relayer syntax check passes after Storacha integration
- [x] GitHub Actions workflow YAML valid
- [x] Circuit assets present in export: bridge.wasm (1.8MB), bridge_final.zkey (6.1MB), verification_key.json (3.5K)

### UI/UX Polish (Design Critique Session)
- [x] 20/20 critique issues fixed across 7 files (globals.css, page.tsx, bridge/layout.tsx, Dashboard, DepositForm, WithdrawForm, NoteManager)
- [x] Interactive states: focus indicators, nav hover, button hover, disabled pointer-events
- [x] Landing: hero line height, spec grid responsive, section left-border anchors, footer fix, bottom CTA separator
- [x] Dashboard: meaningful empty states, deposit CTA, panel header hierarchy
- [x] Deposit: denomination descriptions, connect-wallet button triggers wallet
- [x] Withdraw: step labels visible, helper text, recipient address validation with inline error
- [x] Notes: show/hide password toggle, 3-level password strength indicator, export as primary CTA
- [x] Global: status-pulse animation for loading states, mobile nav horizontal scroll
- [x] All visually verified via Puppeteer screenshots (desktop + mobile)
- [x] Production build passes (8/8 static pages, zero errors)
- Commits: be20bcd, 1225cd0, 88439f5, 370cb76, 475b660

### What Has Been Verified (Live Deploy)
- [x] GitHub Pages deployment live at yonkoo11.github.io/privacy-bridge
- [x] All 8 static pages rendering correctly on live site
- [x] Repo description, homepage, and topic tags set on GitHub

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
