/**
 * Flow EVM client — interact with PrivacyBridge.sol on Flow EVM testnet.
 */
import { ethers } from 'ethers';

const PRIVACY_BRIDGE_ABI = [
  'function lock(uint256 commitment) payable',
  'function getCommitment(uint256 index) view returns (uint256)',
  'function getDepositCount() view returns (uint256)',
  'event CommitmentLocked(uint256 commitment, address token)',
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
 * @param {bigint} amountWei - Amount of FLOW in wei
 */
export async function lockTokens(contractAddress, wallet, commitment, amountWei) {
  const contract = getBridgeContract(contractAddress, wallet);
  const tx = await contract.lock(commitment, { value: amountWei });
  const receipt = await tx.wait();

  // Leaf index is derivable from deposit count (event order).
  // We read it from contract state since the event deliberately omits amount/index.
  const depositCount = await contract.getDepositCount();
  const leafIndex = Number(depositCount) - 1;

  return {
    txHash: receipt.hash,
    leafIndex,
    commitment,
    amount: amountWei,
  };
}

/**
 * Fetch all commitments from the bridge contract via event logs.
 * Returns commitments in deposit order (chronological) for Merkle tree reconstruction.
 */
export async function fetchAllCommitments(contractAddress, provider) {
  const contract = getBridgeContract(contractAddress, provider);

  // Query all CommitmentLocked events from block 0 to latest.
  // Events are returned in block order = deposit order.
  const filter = contract.filters.CommitmentLocked();
  const events = await contract.queryFilter(filter, 0, 'latest');

  return events.map(e => BigInt(e.args[0]));
}

export { FLOW_EVM_TESTNET, PRIVACY_BRIDGE_ABI };
