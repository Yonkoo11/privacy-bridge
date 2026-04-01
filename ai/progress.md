# Privacy Bridge -- Progress

## STATUS (2026-04-01)

### What Changed (Plain English)
- Entire app redesigned with Transit theme (directional flow from EVM to Starknet)
- Landing page: hero reads left-to-right with green dashed line connecting "Deposit on any chain" to "Withdraw on Starknet"
- Chain transit map shows all 6 chains as station nodes with arrow pointing to Starknet
- Protocol sequence shown as horizontal steps (Lock -> Prove -> Verify -> Claim) with green arrows
- Security split into Verified (green checkmarks) and Disclosed (amber warnings)
- Bridge app header shows flow path: EVM > ZK > Starknet
- Deposit page: denominations are vertical list with radio buttons and bar graphs showing anonymity set size
- "I HAVE BACKED UP MY NOTE" checkbox required before locking deposit
- Withdraw page: single "Declassify" button runs all 4 steps automatically with real-time progress tracker
- Dashboard: anonymity bars per denomination with strength labels (Empty/Small/Strong)
- All previous fixes still in place

### Deployed EVM Contracts (5/6)
| Chain | ChainID | Bridge Address |
|-------|---------|---------------|
| Flow EVM | 545 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Ethereum Sepolia | 11155111 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Base Sepolia | 84532 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Arbitrum Sepolia | 421614 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Optimism Sepolia | 11155420 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Polygon Amoy | 80002 | NOT DEPLOYED |

### Design Round 3: Transit Theme (completed)
- 3 proposals: Dossier (split panels), Dispatch (narrow cable), Transit (directional flow)
- Selected Transit with Dispatch elements (progress tracker with elapsed times)
- Ported to production Next.js: 7 files rewritten
- QA: removed unused imports, build clean 8/8 pages
- Design progress tracked at ai/design-progress.md

### All Fixes (cumulative)
1. Circuit artifacts in app/public/
2. Prover paths basePath-aware
3. Dashboard wired to on-chain data
4. WithdrawForm correct currency per chain
5. Landing page all 5 chain contracts
6. Sepolia RPC switched to publicnode
7. Watcher config bug fixed
8. Relayer multichain routing
9. Frontend sourceChain to relayer
10. Denomination validation before wallet
11. Custom 404 and error pages
12. Starknet multichain deploy script
13. Storacha receipt per chain
14. React state-during-render fix
15. Note Manager on-chain status
16. Log scanning deploy block hints
17. Post-deposit Note Manager link
18. README with all addresses
19. Transit design: landing page, bridge layout, all components
20. QA: unused import cleanup

### NOT Done (honest gaps)
- Starknet bridge+token pairs for non-Flow chains not deployed
- Zero real deposits tested from live frontend
- No demo video, no submission
- Relayer/calldata services not deployed to production
- Per-denomination deposit counts still mocked (need event indexing)
- Not deployed to GitHub Pages yet

### Deploy wallet: 0x8902C8b707EB26Ed383F4Aeb86b6058b13190390
### Build: cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build
### Deploy: cd app && npx gh-pages -d out
### Live: https://yonkoo11.github.io/privacy-bridge/
