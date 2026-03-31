export const PRIVACY_BRIDGE_ADDRESS =
  (process.env.NEXT_PUBLIC_BRIDGE_ADDRESS as `0x${string}`) ||
  '0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca';

export const RELAYER_URL =
  process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3001';

export const CALLDATA_URL =
  process.env.NEXT_PUBLIC_CALLDATA_URL || 'http://localhost:3002';

export const DENOMINATIONS = [
  { label: '0.0001 FLOW', value: 100000000000000n },
  { label: '0.001 FLOW', value: 1000000000000000n },
  { label: '0.01 FLOW', value: 10000000000000000n },
  { label: '0.1 FLOW', value: 100000000000000000n },
] as const;

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
