#!/usr/bin/env node
/**
 * Full withdraw flow test — exercises the same code paths the web app uses:
 *
 * 1. Generate note (same as useDeposit.ts)
 * 2. Build merkle tree from on-chain commitments
 * 3. Generate proof (same as prover.ts)
 * 4. Get calldata via HTTP proxy (same as useWithdraw.ts)
 * 5. Submit via relayer HTTP (same as useWithdraw.ts)
 * 6. Verify balances on-chain
 *
 * This is the closest we can get to the browser flow without an actual browser.
 *
 * Prerequisites:
 *   - starknet-devnet --seed 42 on :5050
 *   - node scripts/rpc-proxy.mjs on :5051
 *   - deploy.json exists
 *   - services/calldata on :3002
 *   - services/relayer on :3001
 *   - Relayer fee > 0 bps
 */
import { RpcProvider, Account, CallData, constants } from 'starknet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

// Polyfill for poseidon-lite (expects global crypto)
if (!globalThis.crypto?.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import { poseidon2 } from 'poseidon-lite';
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
const account = new Account(provider, deploy.owner, '0xb137668388dbe9acdfa3bc734cc2c469', '1', constants.TRANSACTION_VERSION.V3);

let pass = 0;
let fail = 0;

function check(condition, msg) {
  if (condition) { console.log(`  PASS: ${msg}`); pass++; }
  else { console.log(`  FAIL: ${msg}`); fail++; }
}

function randomBigInt() {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let result = 0n;
  for (const b of bytes) result = (result << 8n) + BigInt(b);
  return result;
}

function splitU256(val) {
  const low = (val & ((1n << 128n) - 1n)).toString();
  const high = (val >> 128n).toString();
  return { low, high };
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
  console.log('=== Full Withdraw Flow Test ===');
  console.log('(Mirrors web app: useDeposit → useWithdraw → relayer)\n');

  // ---------------------------------------------------------------
  // Step 1: Generate note (same logic as useDeposit.ts)
  // ---------------------------------------------------------------
  console.log('Step 1: Generate note (browser-style)');
  const secret = randomBigInt();
  const nullifier = randomBigInt();
  const amount = 10000000000000000n; // 0.01 FLOW

  // Exact same Poseidon computation as useDeposit.ts
  const innerHash = poseidon2([secret, nullifier]);
  const commitment = poseidon2([innerHash, amount]);
  const nullifierHash = poseidon2([nullifier, nullifier]);

  // Cross-check with SDK (should match)
  const sdkCommitment = computeCommitment(secret, nullifier, amount);
  const sdkNullifierHash = computeNullifierHash(nullifier);
  check(commitment === sdkCommitment, 'browser poseidon matches SDK commitment');
  check(nullifierHash === sdkNullifierHash, 'browser poseidon matches SDK nullifierHash');

  const noteData = {
    secret: secret.toString(),
    nullifier: nullifier.toString(),
    commitment: commitment.toString(),
    nullifierHash: nullifierHash.toString(),
    amount: amount.toString(),
    timestamp: Date.now(),
  };
  console.log(`  Note generated: commitment=${noteData.commitment.slice(0, 20)}...`);

  // ---------------------------------------------------------------
  // Step 2: Simulate deposit on-chain (normally done via Flow EVM lock())
  // We set the merkle root directly since we can't call Flow EVM from here
  // ---------------------------------------------------------------
  console.log('\nStep 2: Build merkle tree + set root on-chain');
  const tree = buildTreeFromCommitments([commitment]);
  const merkleProof = tree.getProof(0);
  check(merkleProof.pathElements.length === 24, `merkle depth = ${merkleProof.pathElements.length}`);

  const rootBig = BigInt(merkleProof.root.toString());
  const setRootTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_merkle_root',
    calldata: CallData.compile({ root: splitU256(rootBig) }),
  });
  await provider.waitForTransaction(setRootTx.transaction_hash);
  check(true, 'merkle root set on-chain');

  // ---------------------------------------------------------------
  // Step 3: Generate proof (same as prover.ts in browser)
  // ---------------------------------------------------------------
  console.log('\nStep 3: Generate ZK proof');
  const recipient = '0x00000000000000000000000000000000000000000000000000000000deadbeef';

  const witness = {
    root: merkleProof.root,
    secret, nullifier, amount,
    recipient,
    pathElements: merkleProof.pathElements,
    pathIndices: merkleProof.pathIndices,
  };
  const proofResult = await generateBridgeProof(witness, { wasmPath: WASM_PATH, zkeyPath: ZKEY_PATH });
  check(proofResult.proof !== undefined, 'proof generated');
  check(proofResult.publicSignals.length === 4, `${proofResult.publicSignals.length} public signals`);

  // Verify public signals make sense
  const proofRoot = BigInt(proofResult.publicSignals[0]);
  const proofNullifier = BigInt(proofResult.publicSignals[1]);
  check(proofRoot === rootBig, 'proof root matches tree root');
  check(proofNullifier === nullifierHash, 'proof nullifierHash matches computed');

  // ---------------------------------------------------------------
  // Step 4: Get calldata via HTTP proxy (same as useWithdraw.ts fetch)
  // ---------------------------------------------------------------
  console.log('\nStep 4: Calldata proxy HTTP request');
  const cdRes = await fetch(`${CALLDATA_URL}/calldata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof: proofResult.proof, publicSignals: proofResult.publicSignals }),
  });
  check(cdRes.ok, `calldata proxy returned ${cdRes.status}`);
  const { calldata } = await cdRes.json();
  check(calldata.length > 100, `got ${calldata.length} felts from proxy`);

  // ---------------------------------------------------------------
  // Step 5: Submit via relayer HTTP (same as useWithdraw.ts fetch)
  // ---------------------------------------------------------------
  console.log('\nStep 5: Relayer HTTP submission');
  const recipBefore = await getTokenBalance(recipient);
  const relayerBefore = await getTokenBalance(deploy.owner);

  const relayRes = await fetch(`${RELAYER_URL}/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calldata, max_fee_bps: 500 }),
  });
  const relayBody = await relayRes.json();
  check(relayRes.ok, `relayer returned ${relayRes.status}`);
  check(relayBody.success === true, 'relayer reports success');
  check(typeof relayBody.txHash === 'string', `tx hash: ${relayBody.txHash?.slice(0, 20)}...`);

  // ---------------------------------------------------------------
  // Step 6: Verify on-chain state
  // ---------------------------------------------------------------
  console.log('\nStep 6: On-chain verification');

  // Check fee from relayer
  const feeRes = await fetch(`${RELAYER_URL}/fee`);
  const { fee_bps } = await feeRes.json();
  const feeBps = BigInt(fee_bps);

  const expectedFee = amount * feeBps / 10000n;
  const expectedNet = amount - expectedFee;

  const recipAfter = await getTokenBalance(recipient);
  const relayerAfter = await getTokenBalance(deploy.owner);
  const recipGot = recipAfter - recipBefore;
  const relayerGot = relayerAfter - relayerBefore;

  check(recipGot === expectedNet, `recipient got ${recipGot} (expected ${expectedNet})`);
  check(relayerGot === expectedFee, `relayer got ${relayerGot} (expected ${expectedFee})`);

  // Nullifier spent
  const nBig = BigInt(proofResult.publicSignals[1]);
  const spentResult = await provider.callContract({
    contractAddress: deploy.bridge_address,
    entrypoint: 'is_nullifier_spent',
    calldata: CallData.compile({ nullifier_hash: splitU256(nBig) }),
  });
  check(BigInt(spentResult[0]) === 1n, 'nullifier marked as spent');

  // Double-spend rejected via relayer
  console.log('\nStep 7: Double-spend via relayer');
  const doubleRes = await fetch(`${RELAYER_URL}/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calldata, max_fee_bps: 500 }),
  });
  check(!doubleRes.ok, `double-spend rejected by relayer (${doubleRes.status})`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
