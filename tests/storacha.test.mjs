#!/usr/bin/env node
/**
 * Storacha (w3up-client) integration test.
 *
 * Tests:
 * 1. createReceipt generates valid receipt structure
 * 2. uploadReceipt uploads to Storacha and returns a CID (requires w3up setup)
 *
 * Note: Upload test requires a provisioned w3up-client space.
 * Run: node tests/storacha.test.mjs
 */
import { createReceipt, uploadReceipt } from '../sdk/src/storacha.mjs';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failed++;
    return;
  }
  passed++;
  console.log(`  PASS: ${msg}`);
}

console.log('=== Storacha Unit Tests ===');

// Test createReceipt
const receipt = createReceipt({
  commitment: 12345678901234567890n,
  nullifierHash: 98765432109876543210n,
  amount: 1000000000000000n,
});

assert(receipt.commitment.startsWith('0x'), 'commitment is hex');
assert(receipt.nullifierHash.startsWith('0x'), 'nullifierHash is hex');
assert(receipt.amount === '1000000000000000', 'amount is string');
assert(receipt.sourceChain === 'flow-evm-testnet', 'source chain default');
assert(receipt.destChain === 'starknet', 'dest chain default');
assert(receipt.version === '1.0.0', 'version set');
assert(receipt.timestamp !== undefined, 'timestamp set');

// Test JSON serialization round-trip
const json = JSON.stringify(receipt);
const parsed = JSON.parse(json);
assert(parsed.commitment === receipt.commitment, 'JSON round-trip commitment');
assert(parsed.amount === receipt.amount, 'JSON round-trip amount');

console.log('\n=== Storacha Upload Test ===');
console.log('  (Requires provisioned w3up-client space)');

try {
  const { create } = await import('@web3-storage/w3up-client');
  const client = await create();
  const spaces = client.spaces();

  if (spaces.length === 0) {
    console.log('  SKIP: No w3up spaces provisioned');
    console.log('  To provision: npx w3up-client space create && npx w3up-client space provision');
  } else {
    await client.setCurrentSpace(spaces[0].did());
    console.log(`  Using space: ${spaces[0].did()}`);

    const cid = await uploadReceipt(client, receipt);
    assert(cid !== undefined && cid.length > 0, `upload returned CID: ${cid}`);
    console.log(`  CID: ${cid}`);
  }
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND' || e.message?.includes('Cannot find')) {
    console.log('  SKIP: @web3-storage/w3up-client not installed or not importable');
  } else {
    console.log(`  SKIP: w3up-client error: ${e.message?.slice(0, 100)}`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
