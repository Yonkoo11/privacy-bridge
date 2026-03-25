/**
 * Flow EVM client — interact with PrivacyBridge.sol on Flow EVM testnet.
 */
import { ethers } from 'ethers';

const PRIVACY_BRIDGE_ABI = [
  'function lock(uint256 commitment) payable',
  'function getCommitment(uint256 index) view returns (uint256)',
  'function getDepositCount() view returns (uint256)',
  'event CommitmentLocked(uint256 commitment, address token)',
  'event DepositETH(uint256 indexed leafIndex, uint256 commitment, uint256 amount)',
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

  const event = receipt.logs
    .map(log => {
      try { return contract.interface.parseLog(log); }
      catch { return null; }
    })
    .find(e => e && e.name === 'DepositETH');

  return {
    txHash: receipt.hash,
    leafIndex: Number(event.args.leafIndex),
    commitment: event.args.commitment,
    amount: event.args.amount,
  };
}

/**
 * Fetch all commitments from the bridge contract (for Merkle tree reconstruction).
 */
export async function fetchAllCommitments(contractAddress, provider) {
  const contract = getBridgeContract(contractAddress, provider);
  const count = await contract.getDepositCount();

  const commitments = [];
  for (let i = 0; i < count; i++) {
    const c = await contract.getCommitment(i);
    commitments.push(BigInt(c));
  }

  return commitments;
}

export { FLOW_EVM_TESTNET, PRIVACY_BRIDGE_ABI };
