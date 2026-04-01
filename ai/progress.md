# Privacy Bridge -- Progress

## STATUS (2026-04-01)

### What Changed (Plain English)
- Fixed a React bug where the deposit confirmation could cause flickering
- Note Manager now checks on-chain if each deposit actually exists (shows Confirmed/Pending)
- Withdrawal page no longer scans millions of blocks -- starts from when the contract was deployed
- After depositing, the app suggests using the Note Manager for encrypted backup
- All previous fixes from this session still in place

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
### Build: cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build
### Deploy: cd app && npx gh-pages -d out
### Live: https://yonkoo11.github.io/privacy-bridge/
