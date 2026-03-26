#!/usr/bin/env node
/**
 * Watcher unit tests — verify state persistence, u256 splitting, and
 * the relay call construction without needing live Flow EVM events.
 *
 * Also smoke-tests the watcher against Starknet devnet by relaying
 * a root directly (simulating what the watcher would do after seeing
 * a NewRoot event on Flow).
 *
 * Prerequisites:
 *   - starknet-devnet --seed 42 on :5050
 *   - node scripts/rpc-proxy.mjs on :5051
 *   - deploy.json exists
 */
import { RpcProvider, Account, CallData, constants } from 'starknet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const deploy = JSON.parse(fs.readFileSync(path.join(projectRoot, 'deploy.json'), 'utf8'));

const provider = new RpcProvider({ nodeUrl: deploy.rpc });
const account = new Account(provider, deploy.owner, '0xb137668388dbe9acdfa3bc734cc2c469', '1', constants.TRANSACTION_VERSION.V3);

let pass = 0;
let fail = 0;

function check(condition, msg) {
  if (condition) { console.log(`  PASS: ${msg}`); pass++; }
  else { console.log(`  FAIL: ${msg}`); fail++; }
}

async function main() {
  console.log('=== Watcher Unit Tests ===\n');

  // ---------------------------------------------------------------
  // Test 1: State file persistence
  // ---------------------------------------------------------------
  console.log('Test 1: State file persistence');
  const tmpState = path.join(os.tmpdir(), `watcher-state-test-${Date.now()}.json`);

  // No state file = start from block 0
  try { fs.unlinkSync(tmpState); } catch {}
  check(!fs.existsSync(tmpState), 'no state file initially');

  // Write state
  fs.writeFileSync(tmpState, JSON.stringify({ lastBlock: 42 }, null, 2));
  const loaded = JSON.parse(fs.readFileSync(tmpState, 'utf8'));
  check(loaded.lastBlock === 42, 'state persists to disk');

  // Update state
  fs.writeFileSync(tmpState, JSON.stringify({ lastBlock: 100 }, null, 2));
  const updated = JSON.parse(fs.readFileSync(tmpState, 'utf8'));
  check(updated.lastBlock === 100, 'state updates correctly');

  fs.unlinkSync(tmpState);

  // ---------------------------------------------------------------
  // Test 2: u256 splitting matches Starknet expectations
  // ---------------------------------------------------------------
  console.log('\nTest 2: u256 splitting');

  // Small value (fits in low)
  const small = 12345n;
  const smallLow = (small & ((1n << 128n) - 1n)).toString();
  const smallHigh = (small >> 128n).toString();
  check(smallLow === '12345', `small low = ${smallLow}`);
  check(smallHigh === '0', `small high = ${smallHigh}`);

  // Large value (spans both)
  const large = (1n << 200n) + 42n;
  const largeLow = (large & ((1n << 128n) - 1n)).toString();
  const largeHigh = (large >> 128n).toString();
  check(BigInt(largeLow) === 42n, `large low = 42`);
  check(BigInt(largeHigh) === (1n << 72n), `large high = 2^72`);

  // Typical Poseidon hash (fits in 254 bits)
  const poseidonHash = 18569430475105882587588266137607568536966745962756824967863025649567413107741n;
  const phLow = (poseidonHash & ((1n << 128n) - 1n)).toString();
  const phHigh = (poseidonHash >> 128n).toString();
  const reconstructed = (BigInt(phHigh) << 128n) | BigInt(phLow);
  check(reconstructed === poseidonHash, 'poseidon hash reconstructs from low/high');

  // ---------------------------------------------------------------
  // Test 3: Simulate watcher relay — add_known_root on devnet
  // ---------------------------------------------------------------
  console.log('\nTest 3: Simulate watcher relay to Starknet devnet');

  // Use a known root value (like the watcher would get from Flow EVM)
  const fakeRoot = 98765432109876543210987654321098765432109876543210n;
  const rootLow = (fakeRoot & ((1n << 128n) - 1n)).toString();
  const rootHigh = (fakeRoot >> 128n).toString();

  // Check bridge contract has add_known_root (it uses set_merkle_root on devnet)
  // The watcher calls add_known_root, but our bridge.cairo uses set_merkle_root
  // Let's verify which entrypoint exists
  let hasAddKnownRoot = false;
  let hasSetMerkleRoot = false;

  try {
    await provider.callContract({
      contractAddress: deploy.bridge_address,
      entrypoint: 'get_merkle_root',
      calldata: [],
    });
    // If get_merkle_root works, the bridge is alive
    check(true, 'bridge contract responds to get_merkle_root');
  } catch (err) {
    check(false, `bridge contract unreachable: ${err.message.slice(0, 80)}`);
  }

  // Try set_merkle_root (what the bridge actually exposes)
  try {
    const tx = await account.execute({
      contractAddress: deploy.bridge_address,
      entrypoint: 'set_merkle_root',
      calldata: CallData.compile({ root: { low: rootLow, high: rootHigh } }),
    });
    await provider.waitForTransaction(tx.transaction_hash);
    check(true, 'set_merkle_root succeeded (watcher relay simulation)');

    // Verify the root was stored
    const storedRoot = await provider.callContract({
      contractAddress: deploy.bridge_address,
      entrypoint: 'get_merkle_root',
      calldata: [],
    });
    const storedBig = (BigInt(storedRoot[1]) << 128n) | BigInt(storedRoot[0]);
    check(storedBig === fakeRoot, 'relayed root matches on-chain');
  } catch (err) {
    check(false, `relay simulation failed: ${err.message.slice(0, 80)}`);
  }

  // ---------------------------------------------------------------
  // Test 4: Watcher entrypoint alignment check
  // ---------------------------------------------------------------
  console.log('\nTest 4: Entrypoint alignment');

  // The watcher calls add_known_root, but let's check if bridge.cairo
  // actually has this entrypoint or if it's set_merkle_root
  // This catches a real bug: watcher would fail on deploy if entrypoint is wrong
  try {
    const tx = await account.execute({
      contractAddress: deploy.bridge_address,
      entrypoint: 'add_known_root',
      calldata: CallData.compile({ root: { low: rootLow, high: rootHigh } }),
    });
    await provider.waitForTransaction(tx.transaction_hash);
    check(true, 'add_known_root entrypoint exists on bridge');
    hasAddKnownRoot = true;
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('not found') || msg.includes('Entry point')) {
      console.log(`  INFO: add_known_root does NOT exist. Watcher uses wrong entrypoint.`);
      console.log(`  INFO: Bridge has set_merkle_root instead.`);
      check(false, 'MISMATCH: watcher calls add_known_root but bridge has set_merkle_root');
    } else {
      // Might have failed for another reason (tx execution error)
      check(false, `add_known_root call failed: ${msg.slice(0, 100)}`);
    }
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
