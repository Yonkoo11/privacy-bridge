# Privacy Bridge - Overnight Build Tasks

## Context
Privacy Bridge is a multichain ZK privacy bridge. 5/6 EVM chains deployed, frontend live at yonkoo11.github.io/privacy-bridge. 93/93 tests passing. Need to polish, test on live chains, and prepare for submission.

## Critical files
- app/src/ -- Next.js frontend
- contracts/ -- Solidity + Cairo
- services/ -- watcher, relayer, calldata
- ai/progress.md -- session state

## Tasks

- [ ] Test a real deposit on Ethereum Sepolia from the live frontend (connect wallet to Sepolia, select 0.0001 ETH denomination, generate note, lock). Verify the transaction confirms on-chain. Save the note JSON for verification. If anything breaks, fix it.

- [ ] Verify the ChainSelector component works on the live site: connect wallet, switch between all 5 deployed chains (Flow, Sepolia, Base, Arbitrum, Optimism), verify the denomination labels change (FLOW vs ETH), verify "coming soon" shows for Polygon.

- [ ] The landing page contract section only shows Flow EVM contracts. Add a per-chain contract table in page.tsx showing all deployed bridge addresses. Read deployments/*.json for the addresses.

- [ ] The dashboard (app/src/components/Dashboard.tsx) shows hardcoded TVL "0.0000 FLOW". Wire it to read actual on-chain data: call getDepositCount() and getLatestRoot() on the current chain's bridge contract using wagmi useReadContract. Show real deposit count and latest root.

- [ ] Update README.md deployed contracts section to list all 5 chains with their bridge addresses from deployments/*.json.

- [ ] Run next build to verify 0 errors. If build fails, fix the errors. Deploy to GitHub Pages using: npx gh-pages -d app/out

- [ ] Update ai/progress.md with final status.
