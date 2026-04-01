# Privacy Bridge -- Progress

## STATUS (2026-04-01)

### What Changed (Plain English)
- Circuit files (the math proof files) are now included in the website build -- before, the withdrawal page would crash trying to load them
- The Dashboard page now reads real data from the blockchain instead of showing fake zeros
- The withdrawal page shows the correct currency name (ETH, FLOW, etc.) based on which chain the deposit was made on
- The landing page now shows all 5 deployed chain addresses, not just Flow
- Added a clear warning on the withdrawal page when Starknet side isn't deployed yet for that chain
- README updated with all chain addresses
- Website rebuilt and published

### Deployed EVM Contracts (5/6)
| Chain | ChainID | Bridge Address |
|-------|---------|---------------|
| Flow EVM | 545 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Ethereum Sepolia | 11155111 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Base Sepolia | 84532 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Arbitrum Sepolia | 421614 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Optimism Sepolia | 11155420 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Polygon Amoy | 80002 | NOT DEPLOYED (need ~1.2 POL) |

### Done
- Multichain frontend with ChainSelector (6 chains, 5 with EVM contracts)
- 93/93 tests on devnet
- Security fixes (field reduction, ABI, CORS, rate limiter, privacy leak)
- deploy-evm.mjs generalized deploy script
- GitHub Pages live at yonkoo11.github.io/privacy-bridge
- Circuit artifacts (bridge.wasm, bridge_final.zkey) in app/public/
- Prover paths basePath-aware for GitHub Pages
- Dashboard reads live on-chain data (deposit count, latest Merkle root)
- WithdrawForm shows correct currency per source chain
- Landing page shows all 5 chain contracts
- README updated with all chain addresses
- Honest disclosure on WithdrawForm for non-Flow chains

### NOT Done (gaps)
- Starknet bridge+token pairs for non-Flow chains not deployed (only Flow has Starknet-side)
- Zero real deposits tested from live frontend
- No demo video, no submission
- Relayer/calldata services default to localhost (no production deployment)
- Per-denomination deposit counts not implemented (requires event indexing)

### Deploy wallet: 0x8902C8b707EB26Ed383F4Aeb86b6058b13190390
### Build: cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build (~7 min)
### Deploy: cd app && npx gh-pages -d out
