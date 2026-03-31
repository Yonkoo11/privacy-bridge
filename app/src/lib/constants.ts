import { CHAIN_CONFIG } from './chains';

export function getBridgeAddress(chainId: number): `0x${string}` | null {
  return CHAIN_CONFIG[chainId]?.bridgeAddress ?? null;
}

export function getDenominations(chainId: number) {
  const symbol = CHAIN_CONFIG[chainId]?.chain.nativeCurrency.symbol ?? 'ETH';
  return [
    { label: `0.0001 ${symbol}`, value: 100000000000000n },
    { label: `0.001 ${symbol}`, value: 1000000000000000n },
    { label: `0.01 ${symbol}`, value: 10000000000000000n },
    { label: `0.1 ${symbol}`, value: 100000000000000000n },
  ] as const;
}

export function getDenomHints(chainId: number): Record<string, string> {
  const denoms = getDenominations(chainId);
  return {
    [denoms[0].label]: 'Micro - test transactions',
    [denoms[1].label]: 'Small - low-value transfers',
    [denoms[2].label]: 'Medium - standard privacy',
    [denoms[3].label]: 'Large - high-value privacy',
  };
}

export const RELAYER_URL =
  process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3001';

export const CALLDATA_URL =
  process.env.NEXT_PUBLIC_CALLDATA_URL || 'http://localhost:3002';

// ABI is identical across all EVM deployments
export const PRIVACY_BRIDGE_ABI = [
  {
    inputs: [{ name: 'commitment', type: 'uint256' }],
    name: 'lock',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'commitmentExists',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextLeafIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'commitment', type: 'uint256' },
      { indexed: false, name: 'leafIndex', type: 'uint256' },
    ],
    name: 'CommitmentLocked',
    type: 'event',
  },
  {
    inputs: [],
    name: 'getLatestRoot',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getDepositCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'root', type: 'uint256' }],
    name: 'isKnownRoot',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: 'root', type: 'uint256' }],
    name: 'NewRoot',
    type: 'event',
  },
] as const;
