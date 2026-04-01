# Privacy Bridge -- Progress

## STATUS (2026-04-01)

### What Changed (Plain English)
- The landing page now has the "Transit" design: a visual chain map showing all 6 networks with dots and arrows pointing to Starknet
- The protocol steps (Lock, Prove, Verify, Claim) are now shown as a horizontal flow with green arrows between them
- Security info is split into two columns: "Verified" (green checkmarks) and "Disclosed" (amber warnings) so visitors can quickly see what's solid and what's not
- A compact specs bar at the bottom shows circuit size, tree depth, test count, and chain count in one line
- The header now shows an "EVM > ZK > Starknet" flow indicator
- On mobile, the layout stacks vertically and the chain map scrolls horizontally
- All previous fixes from prior sessions still in place

### Deployed EVM Contracts (5/6)
| Chain | ChainID | Bridge Address |
|-------|---------|---------------|
| Flow EVM | 545 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Ethereum Sepolia | 11155111 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Base Sepolia | 84532 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Arbitrum Sepolia | 421614 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Optimism Sepolia | 11155420 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Polygon Amoy | 80002 | NOT DEPLOYED |

### All Fixes This Session
1. Circuit artifacts copied to app/public/ (withdrawals would have 404'd)
2. Prover paths basePath-aware for GitHub Pages
3. Dashboard wired to on-chain getDepositCount + getLatestRoot
4. WithdrawForm shows correct currency per source chain
5. Landing page shows all 5 chain contracts
6. Sepolia RPC switched to publicnode
7. Watcher config self-reference bug fixed
8. Relayer supports multichain Starknet routing
9. Frontend passes sourceChain to relayer
10. Denomination validation before wallet popup
11. Custom 404 and error pages
12. Multi-chain Starknet deploy script created
13. Storacha receipt uses actual source chain
14. React state-during-render fixed (useEffect)
15. Note Manager checks on-chain deposit status
16. Log scanning optimized with deploy block hints
17. Post-deposit link to Note Manager
18. README updated with all chain addresses

### NOT Done (honest gaps)
- Starknet bridge+token pairs for non-Flow chains not deployed
- Zero real deposits tested from live frontend
- No demo video, no submission
- Relayer/calldata services not deployed to production
- Per-denomination deposit counts in Dashboard

### Deploy wallet: 0x8902C8b707EB26Ed383F4Aeb86b6058b13190390
19. Transit design ported: globals.css + page.tsx rewritten with chain map, protocol flow, security dossier, specs bar

### NEXT STEP: Generate 3 design proposals
- Read ai/design-research.md for the full research brief
- Read ai/design-progress.md for design workflow state (Round 3, Phase 2 in progress)
- Read existing proposals/ directory for Round 2 proposals (selected: Redact theme)
- Generate 3 new HTML proposals that EVOLVE the Redact theme for multichain
- Key innovations: anonymity set display per denomination, Source->Dest bridge panels, 1-click withdrawal
- Style config at ~/.claude/style.config.md
- Design lessons at ~/.claude/projects/-Users-yonko/memory/design-lessons.md
- Current CSS: app/src/app/globals.css (IBM Plex Mono + Space Grotesk, zero border-radius, gap-px grids, stamps)
- Current components: app/src/components/ (ChainSelector, DepositForm, WithdrawForm, Dashboard, NoteManager)

### Build: cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build
### Deploy: cd app && npx gh-pages -d out
### Live: https://yonkoo11.github.io/privacy-bridge/
