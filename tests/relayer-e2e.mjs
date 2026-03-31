#!/usr/bin/env node
/**
 * End-to-end test of the relayer service.
 *
 * Flow: generate proof → calldata proxy (HTTP) → relayer (HTTP) → verify on-chain
 *
 * Prerequisites:
 *   - starknet-devnet --seed 42 on :5050
 *   - node scripts/rpc-proxy.mjs on :5051
 *   - deploy.json exists
 *   - services/calldata on :3002
 *   - services/relayer on :3001
 *   - Relayer fee > 0 bps (set via set_relayer_fee)
 */
import { RpcProvider, Account, CallData, constants } from 'starknet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

import { computeCommitment, computeNullifierHash } from '../sdk/src/poseidon.mjs';
import { buildTreeFromCommitments } from '../sdk/src/merkle.mjs';
import { generateBridgeProof } from '../sdk/src/prover.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const deploy = JSON.parse(fs.readFileSync(path.join(projectRoot, 'deploy.json'), 'utf8'));

const WASM_PATH = path.join(projectRoot, 'circuits/target/bridge_js/bridge.wasm');
const ZKEY_PATH = path.join(projectRoot, 'circuits/target/bridge_final.zkey');

const CALLDATA_URL = 'http://127.0.0.1:3002';
const RELAYER_URL = 'http://127.0.0.1:3001';

const provider = new RpcProvider({ nodeUrl: deploy.rpc });

function randomField() {
  return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
}

async function getTokenBalance(address) {
  const result = await provider.callContract({
    contractAddress: deploy.token_address,
    entrypoint: 'balance_of',
    calldata: CallData.compile({ account: address }),
  });
  return (BigInt(result[1]) << 128n) | BigInt(result[0]);
}

async function main() {
  console.log('=== Relayer E2E Test ===\n');

  // 1. Generate deposit
  const secret = randomField();
  const nullifier = randomField();
  const amount = 10000000000000000n; // 0.01 FLOW
  // Use a fresh recipient that isn't the relayer
  const recipient = '0x00000000000000000000000000000000000000000000000000000000deadbeef';

  const commitment = computeCommitment(secret, nullifier, amount);
  const tree = buildTreeFromCommitments([commitment]);
  const merkleProof = tree.getProof(0);

  console.log('1. Deposit generated');
  console.log(`   Amount: 0.01 FLOW`);
  console.log(`   Recipient: ${recipient}`);

  // 2. Generate proof
  const witness = {
    root: merkleProof.root,
    secret, nullifier, amount,
    recipient,
    pathElements: merkleProof.pathElements,
    pathIndices: merkleProof.pathIndices,
  };
  const proofResult = await generateBridgeProof(witness, { wasmPath: WASM_PATH, zkeyPath: ZKEY_PATH });
  console.log('2. Proof generated locally');

  // 3. Set merkle root on-chain (simulates watcher relay)
  const account = new Account(provider, deploy.owner, '0xb137668388dbe9acdfa3bc734cc2c469', '1', constants.TRANSACTION_VERSION.V3);
  const rootBig = BigInt(proofResult.publicSignals[0]);
  const low = rootBig & ((1n << 128n) - 1n);
  const high = rootBig >> 128n;
  const setRootTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_merkle_root',
    calldata: CallData.compile({ root: { low: low.toString(), high: high.toString() } }),
  });
  await provider.waitForTransaction(setRootTx.transaction_hash);
  console.log('3. Root set on-chain');

  // 3b. Set relayer fee to 50 bps (0.5%)
  const setFeeTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_relayer_fee',
    calldata: CallData.compile({ fee_bps: { low: '50', high: '0' } }),
  });
  await provider.waitForTransaction(setFeeTx.transaction_hash);
  console.log('3b. Relayer fee set to 50 bps');

  // 4. Get calldata via proxy
  console.log('4. Calling calldata proxy...');
  const cdRes = await fetch(`${CALLDATA_URL}/calldata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof: proofResult.proof, publicSignals: proofResult.publicSignals }),
  });
  if (!cdRes.ok) {
    const err = await cdRes.text();
    throw new Error(`Calldata proxy failed (${cdRes.status}): ${err}`);
  }
  const { calldata } = await cdRes.json();
  console.log(`   Got ${calldata.length} felts from proxy`);

  // Record balances before relay
  const recipBefore = await getTokenBalance(recipient);
  const relayerBefore = await getTokenBalance(deploy.owner);

  // 5. Submit via relayer
  console.log('5. Submitting to relayer...');
  const relayRes = await fetch(`${RELAYER_URL}/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calldata, max_fee_bps: 500 }),
  });

  const relayBody = await relayRes.json();
  console.log(`   Relayer response (${relayRes.status}):`, JSON.stringify(relayBody).slice(0, 200));

  if (!relayRes.ok) {
    throw new Error(`Relayer failed: ${JSON.stringify(relayBody)}`);
  }

  // 6. Verify on-chain
  console.log('6. Verifying on-chain...');
  const recipAfter = await getTokenBalance(recipient);
  const relayerAfter = await getTokenBalance(deploy.owner);

  const expectedFee = amount * 50n / 10000n; // 0.5%
  const expectedNet = amount - expectedFee;

  const recipGot = recipAfter - recipBefore;
  const relayerGot = relayerAfter - relayerBefore;

  console.log(`   Recipient got: ${recipGot} (expected ${expectedNet})`);
  console.log(`   Relayer got:   ${relayerGot} (expected ${expectedFee})`);

  let pass = 0;
  let fail = 0;

  if (recipGot === expectedNet) { console.log('   PASS: recipient balance correct'); pass++; }
  else { console.log(`   FAIL: recipient balance wrong`); fail++; }

  if (relayerGot === expectedFee) { console.log('   PASS: relayer fee collected'); pass++; }
  else { console.log(`   FAIL: relayer fee wrong`); fail++; }

  // Check nullifier spent
  const nullifierBig = BigInt(proofResult.publicSignals[1]);
  const nLow = nullifierBig & ((1n << 128n) - 1n);
  const nHigh = nullifierBig >> 128n;
  const spentResult = await provider.callContract({
    contractAddress: deploy.bridge_address,
    entrypoint: 'is_nullifier_spent',
    calldata: CallData.compile({ nullifier_hash: { low: nLow.toString(), high: nHigh.toString() } }),
  });
  if (BigInt(spentResult[0]) === 1n) { console.log('   PASS: nullifier spent'); pass++; }
  else { console.log('   FAIL: nullifier not spent'); fail++; }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
