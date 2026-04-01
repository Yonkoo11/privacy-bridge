import { defineChain, type Chain } from 'viem';

export const flowEvmTestnet = defineChain({
  id: 545,
  name: 'Flow EVM Testnet',
  nativeCurrency: { name: 'FLOW', symbol: 'FLOW', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.evm.nodes.onflow.org'] } },
  blockExplorers: { default: { name: 'FlowScan', url: 'https://evm-testnet.flowscan.io' } },
  testnet: true,
});

export const sepolia = defineChain({
  id: 11155111,
  name: 'Ethereum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] } },
  blockExplorers: { default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' } },
  testnet: true,
});

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' } },
  testnet: true,
});

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] } },
  blockExplorers: { default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' } },
  testnet: true,
});

export const polygonAmoy = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-amoy.polygon.technology'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' } },
  testnet: true,
});

export const optimismSepolia = defineChain({
  id: 11155420,
  name: 'Optimism Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.optimism.io'] } },
  blockExplorers: { default: { name: 'Etherscan', url: 'https://sepolia-optimistic.etherscan.io' } },
  testnet: true,
});

export const SUPPORTED_CHAINS: Chain[] = [
  flowEvmTestnet, sepolia, baseSepolia, arbitrumSepolia, polygonAmoy, optimismSepolia,
];

export const SUPPORTED_CHAIN_IDS = new Set(SUPPORTED_CHAINS.map(c => c.id));

export interface ChainConfig {
  chain: Chain;
  bridgeAddress: `0x${string}` | null;
  tokenSymbol: string;
  deployBlock?: bigint; // block number when bridge was deployed (for efficient log scanning)
}

export const CHAIN_CONFIG: Record<number, ChainConfig> = {
  [flowEvmTestnet.id]: {
    chain: flowEvmTestnet,
    bridgeAddress: '0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca',
    tokenSymbol: 'pFLOW',
    deployBlock: 0n, // Flow EVM testnet is low-block-count, scan from 0
  },
  [sepolia.id]: {
    chain: sepolia,
    bridgeAddress: '0x2eaEF8016D2a7Dc01677E57183a167649cB07402',
    tokenSymbol: 'pETH',
    deployBlock: 10550000n, // Deployed 2026-03-31
  },
  [baseSepolia.id]: {
    chain: baseSepolia,
    bridgeAddress: '0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca',
    tokenSymbol: 'pBASE',
    deployBlock: 39540000n, // Deployed 2026-03-31
  },
  [arbitrumSepolia.id]: {
    chain: arbitrumSepolia,
    bridgeAddress: '0x2eaEF8016D2a7Dc01677E57183a167649cB07402',
    tokenSymbol: 'pARB',
    deployBlock: 254850000n, // Deployed 2026-03-31
  },
  [polygonAmoy.id]: {
    chain: polygonAmoy,
    bridgeAddress: null,
    tokenSymbol: 'pPOL',
  },
  [optimismSepolia.id]: {
    chain: optimismSepolia,
    bridgeAddress: '0x2eaEF8016D2a7Dc01677E57183a167649cB07402',
    tokenSymbol: 'pOP',
    deployBlock: 41520000n, // Deployed 2026-03-31
  },
};

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIG[chainId];
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const config = CHAIN_CONFIG[chainId];
  if (!config) return '';
  const explorer = config.chain.blockExplorers?.default?.url;
  return explorer ? `${explorer}/tx/${txHash}` : '';
}
