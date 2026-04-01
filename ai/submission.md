# PL Genesis Submission -- Copy-Paste Ready

## Project repo link
https://github.com/Yonkoo11/privacy-bridge

## Project name
Privacy Bridge

## Challenges (select from dropdown)
Flow Blockchain, Storacha

## Project tagline (100 chars max)
ZK privacy bridge: deposit on any EVM chain, withdraw on Starknet. No link between them.

## Project description

Privacy Bridge lets you move tokens across chains without leaving a trace. You deposit native tokens into a fixed-denomination pool on any of 6 supported EVM chains (Flow EVM, Ethereum, Base, Arbitrum, Optimism, Polygon). The deposit generates a Poseidon commitment that gets inserted into an on-chain Merkle tree. You receive a secret note file. Later, you use that note to generate a Groth16 zero-knowledge proof that you own a valid deposit, without revealing which one. The proof is verified on Starknet by a garaga verifier, and shielded tokens are minted to any recipient address. There is zero on-chain link between the deposit and the withdrawal.

The core ZK circuit has 6,634 constraints and uses a depth-24 Poseidon Merkle tree. Fixed denomination pools (0.0001, 0.001, 0.01, 0.1 of the native token) prevent amount-based transaction linking. A relayer pattern lets users withdraw without revealing their Starknet address to the sequencer.

During the hackathon, the project expanded from a single-chain Flow EVM bridge to a full multichain system supporting 6 EVM source chains. The frontend was redesigned with a transit-flow visual language that communicates the bridge concept at a glance. Real on-chain deposit counts are pulled from each chain's bridge contract to show pool size and anonymity set strength.

The project uses Flow EVM as the primary source chain and Storacha for IPFS-based receipt storage on withdrawal transactions.

## Technologies (select from dropdown)
Blockchain, Solidity, Cairo, JavaScript/TypeScript, Next.js, Zero Knowledge Proofs

## Working prototype link
https://yonkoo11.github.io/privacy-bridge/

## Read me documentation
https://github.com/Yonkoo11/privacy-bridge/blob/main/README.md

## Video link
(upload the generated demo video file)

## When did you start building this?
Before this hackathon
