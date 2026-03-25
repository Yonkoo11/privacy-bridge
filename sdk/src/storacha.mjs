/**
 * Storacha (w3up-client) — upload bridge receipts to IPFS.
 *
 * Each bridge transfer gets a receipt stored on IPFS:
 * { commitment, sourceChain, destChain, nullifierHash, timestamp }
 *
 * The CID is stored on-chain in the Starknet mint contract.
 */

/**
 * Upload a bridge receipt to Storacha and return the CID.
 * @param {object} client - Initialized w3up-client instance
 * @param {object} receipt - Bridge receipt data
 */
export async function uploadReceipt(client, receipt) {
  const json = JSON.stringify(receipt, (_, v) =>
    typeof v === 'bigint' ? '0x' + v.toString(16) : v
  );

  const blob = new Blob([json], { type: 'application/json' });
  const cid = await client.uploadFile(blob);
  return cid.toString();
}

/**
 * Create a bridge receipt object.
 */
export function createReceipt({ commitment, nullifierHash, amount, sourceChain, destChain }) {
  return {
    commitment: '0x' + commitment.toString(16),
    nullifierHash: '0x' + nullifierHash.toString(16),
    amount: amount.toString(),
    sourceChain: sourceChain || 'flow-evm-testnet',
    destChain: destChain || 'starknet',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
}
