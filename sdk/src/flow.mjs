/**
 * Flow EVM client — interact with PrivacyBridge.sol on Flow EVM testnet.
 */
import { ethers } from 'ethers';

// Fix 1: Allowed denominations (wei)
export const ALLOWED_DENOMINATIONS = [
  100000000000000n,      // 0.0001
  1000000000000000n,     // 0.001
  10000000000000000n,    // 0.01
  100000000000000000n,   // 0.1
];

const PRIVACY_BRIDGE_ABI = [
  'function lock(uint256 commitment) payable',
  'function getDepositCount() view returns (uint256)',
  'function isKnownRoot(uint256 root) view returns (bool)',
  'function getLatestRoot() view returns (uint256)',
  'function initiateEmergencyWithdraw()',
  'function cancelEmergencyWithdraw()',
  'function executeEmergencyWithdraw(address to)',
  'function emergencyWithdrawTime() view returns (uint256)',
  'function allowedDenominations(uint256) view returns (bool)',
  'function owner() view returns (address)',
  'event CommitmentLocked(uint256 indexed commitment, uint256 leafIndex)',
  'event NewRoot(uint256 root)',
  'event EmergencyInitiated(uint256 executeAfter)',
  'event EmergencyCancelled()',
  'event EmergencyExecuted(address to, uint256 amount)',
];

const FLOW_EVM_TESTNET = {
  rpcUrl: 'https://testnet.evm.nodes.onflow.org',
  chainId: 545,
  name: 'Flow EVM Testnet',
};

export function getFlowProvider() {
  return new ethers.JsonRpcProvider(FLOW_EVM_TESTNET.rpcUrl, {
    chainId: FLOW_EVM_TESTNET.chainId,
    name: FLOW_EVM_TESTNET.name,
  });
}

export function getBridgeContract(address, signerOrProvider) {
  return new ethers.Contract(address, PRIVACY_BRIDGE_ABI, signerOrProvider);
}

/**
 * Lock FLOW tokens with a Poseidon commitment.
 * @param {string} contractAddress - PrivacyBridge contract on Flow EVM
 * @param {ethers.Wallet} wallet - Funded wallet
 * @param {bigint} commitment - Poseidon commitment hash
 * @param {bigint} amountWei - Amount of FLOW in wei (must be allowed denomination)
 */
export async function lockTokens(contractAddress, wallet, commitment, amountWei) {
  // Fix 1: Validate denomination
  if (!ALLOWED_DENOMINATIONS.includes(amountWei)) {
    throw new Error(`Invalid denomination: ${amountWei}. Allowed: ${ALLOWED_DENOMINATIONS.join(', ')}`);
  }

  const contract = getBridgeContract(contractAddress, wallet);
  const tx = await contract.lock(commitment, { value: amountWei });
  const receipt = await tx.wait();

  // Extract leafIndex from CommitmentLocked event rather than a separate RPC call
  const lockEvent = receipt.logs
    .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === 'CommitmentLocked');
  const leafIndex = lockEvent ? Number(lockEvent.args[1]) : Number(await contract.getDepositCount()) - 1;

  return {
    txHash: receipt.hash,
    leafIndex,
    commitment,
    amount: amountWei,
  };
}

/**
 * Fetch all commitments from the bridge contract via event logs.
 * Returns commitments sorted by leafIndex for correct Merkle tree reconstruction.
 */
export async function fetchAllCommitments(contractAddress, provider) {
  const contract = getBridgeContract(contractAddress, provider);

  const filter = contract.filters.CommitmentLocked();
  const events = await contract.queryFilter(filter, 0, 'latest');

  return events
    .map(e => ({ commitment: BigInt(e.args[0]), leafIndex: Number(e.args[1]) }))
    .sort((a, b) => a.leafIndex - b.leafIndex)
    .map(e => e.commitment);
}

export { FLOW_EVM_TESTNET, PRIVACY_BRIDGE_ABI };
