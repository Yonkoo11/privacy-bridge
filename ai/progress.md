# Privacy Bridge -- Progress

## STATUS (2026-04-01, ~7 hours to deadline)

### Deployed EVM Contracts (5/6)
| Chain | ChainID | Bridge Address |
|-------|---------|---------------|
| Flow EVM | 545 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Ethereum Sepolia | 11155111 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Base Sepolia | 84532 | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca |
| Arbitrum Sepolia | 421614 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Optimism Sepolia | 11155420 | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 |
| Polygon Amoy | 80002 | NOT DEPLOYED (need ~1.2 POL) |

### NOT Done (critical gaps)
- Starknet bridge+token pairs for new chains NOT deployed (only Flow has one)
- Zero real deposits tested from live frontend
- Dashboard shows hardcoded data, not live on-chain
- Landing page only lists Flow contracts
- README contracts section outdated
- No demo video, no submission

### Done
- Multichain frontend with ChainSelector (6 chains, 5 with EVM contracts)
- 93/93 tests on devnet
- Security fixes (field reduction, ABI, CORS, rate limiter, privacy leak)
- deploy-evm.mjs generalized deploy script
- GitHub Pages live at yonkoo11.github.io/privacy-bridge

### Deploy wallet: 0x8902C8b707EB26Ed383F4Aeb86b6058b13190390
### Key: provided via /tmp/.deploy-pk (deleted after use)
### Build: cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build (~7 min)
