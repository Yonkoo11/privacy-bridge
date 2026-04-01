# Privacy Bridge -- Progress

## STATUS (2026-04-01)

### What Changed (Plain English)
- Circuit files now load correctly on the live website (were missing before)
- Dashboard shows real deposit counts and Merkle roots from each chain's contract
- Withdrawal page shows correct currency name per chain (not always "FLOW")
- Landing page shows all 5 deployed chain addresses
- Added honest warning when Starknet withdrawal isn't available for a chain yet
- Relayer can now route to different Starknet bridges per source chain
- Frontend tells the relayer which chain a deposit came from
- Invalid deposit amounts are caught before the wallet pops up
- Custom 404 and error pages match the site design
- Sepolia RPC switched to publicnode (old one was unreliable)
- Fixed a watcher config bug where fallback referenced itself

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
- deploy-evm.mjs generalized EVM deploy script
- deploy-starknet-multichain.mjs for all 5 Starknet bridge+token pairs
- GitHub Pages live at yonkoo11.github.io/privacy-bridge
- Circuit artifacts in app/public/, basePath-aware prover paths
- Dashboard reads live on-chain data (deposit count, latest Merkle root)
- WithdrawForm shows correct currency per source chain
- Landing page shows all 5 chain contracts
- README updated with all chain addresses
- Honest disclosure on WithdrawForm for non-Flow chains
- Relayer supports multichain Starknet routing via deploy-multichain.json
- Frontend passes sourceChain to relayer
- Denomination validation in deposit hook
- Custom 404 and error pages
- Sepolia RPC fixed (publicnode)
- Watcher config self-reference bug fixed

### NOT Done (honest gaps)
- Starknet bridge+token pairs for non-Flow chains not deployed (script ready, needs running devnet)
- Zero real deposits tested from live frontend
- No demo video, no submission
- Relayer/calldata services default to localhost (no production deployment)
- Per-denomination deposit counts in Dashboard (requires event indexing)
- Polygon Amoy EVM contract not deployed (insufficient testnet funds)

### What I Did NOT Do
- Did not deploy to Starknet Sepolia (no funded account)
- Did not run the multi-chain devnet deploy script (needs devnet running)
- Did not test end-to-end withdrawal flow on any chain
- Did not create demo video

### Confidence Level
- EVM deposit side: HIGH -- 5 contracts verified, frontend reads live data
- Circuit/crypto alignment: HIGH -- verified circuit matches frontend commitment scheme
- Starknet withdrawal: LOW for non-Flow -- pairs not deployed, no tested withdrawal
- Overall demo quality: MEDIUM -- polished frontend, but full round trip untested

### Deploy wallet: 0x8902C8b707EB26Ed383F4Aeb86b6058b13190390
### Build: cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build
### Deploy: cd app && npx gh-pages -d out
