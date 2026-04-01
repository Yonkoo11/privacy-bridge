# Privacy Bridge -- Progress

## Current Status (2026-04-01)

### Deployed Contracts (5/6 chains live)
| Chain | Bridge Address | Status |
|-------|---------------|--------|
| Flow EVM (545) | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca | Live, 2 deposits |
| Ethereum Sepolia (11155111) | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 | Live |
| Base Sepolia (84532) | 0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca | Live |
| Arbitrum Sepolia (421614) | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 | Live |
| Optimism Sepolia (11155420) | 0x2eaEF8016D2a7Dc01677E57183a167649cB07402 | Live |
| Polygon Amoy (80002) | -- | Needs ~1.2 POL (have 0.53) |

### Frontend
- GitHub Pages live at yonkoo11.github.io/privacy-bridge
- ChainSelector component with 6 chains
- Dynamic denominations per chain
- Notes save sourceChainId
- WithdrawForm reads source chain from note
- Build: `cd app && NEXT_PUBLIC_BASE_PATH="/privacy-bridge" npx next build` (~7 min)

### What's Done
- Multichain frontend (6 chains, 5 deployed)
- Security fixes: field reduction, ABI alignment, CORS, rate limiter, privacy leak
- 93/93 tests passing on devnet
- Honest trust model documentation
- deploy-evm.mjs generalized deploy script

### Deploy wallet
- Address: 0x8902C8b707EB26Ed383F4Aeb86b6058b13190390
- Key must be provided via /tmp/.deploy-pk file

### What Still Needs Work
- [ ] Polygon Amoy deploy (needs more POL)
- [ ] Demo video
- [ ] Hackathon submission
- [ ] Test a real deposit on Sepolia from the live frontend
- [ ] Update progress.md before compacting
