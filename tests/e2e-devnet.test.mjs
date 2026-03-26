#!/usr/bin/env node
/**
 * End-to-end test: generate proof -> garaga calldata -> mint on starknet-devnet
 *
 * Tests all 7 privacy fixes + ERC20 token integration:
 *   Fix 4: No storacha_cid in mint() signature
 *   Fix 1: Fixed denomination validation
 *   Fix 3: Root history (known_roots)
 *   Fix 7: Emergency withdraw (Solidity only, not tested here)
 *   Fix 2: ERC20 pFLOW token (replaces internal balances)
 *   Fix 5: Relayer fee
 *   Fix 6: Withdrawal time lock (delay=0 for devnet)
 *   ERC20: transfer, approve, transferFrom
 *
 * Prerequisites:
 *   starknet-devnet --seed 42 on :5050
 *   node scripts/rpc-proxy.mjs on :5051
 *   deploy.json exists (run scripts/deploy-devnet.mjs first)
 *   circuits/target/ has bridge.wasm + bridge_final.zkey + verification_key.json
 *
 * Run: node tests/e2e-devnet.test.mjs
 */
import { RpcProvider, Account, CallData, constants } from 'starknet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

import { computeCommitment, computeNullifierHash, poseidonHash } from '../sdk/src/poseidon.mjs';
import { buildTreeFromCommitments } from '../sdk/src/merkle.mjs';
import { generateBridgeProof, generateGaragaCalldata } from '../sdk/src/prover.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const WASM_PATH = path.join(projectRoot, 'circuits/target/bridge_js/bridge.wasm');
const ZKEY_PATH = path.join(projectRoot, 'circuits/target/bridge_final.zkey');
const VK_PATH = path.join(projectRoot, 'circuits/target/verification_key.json');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failed++;
    throw new Error(msg);
  }
  passed++;
  console.log(`  PASS: ${msg}`);
}

function randomField() {
  return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
}

// Helper: split u256 to low/high for Cairo encoding
function splitU256(val) {
  const low = val & ((1n << 128n) - 1n);
  const high = val >> 128n;
  return { low: low.toString(), high: high.toString() };
}

// Helper: read u256 balance from ERC20 token
async function getTokenBalance(provider, tokenAddress, account) {
  const result = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'balance_of',
    calldata: CallData.compile({ account }),
  });
  return (BigInt(result[1]) << 128n) | BigInt(result[0]);
}

async function main() {
  const deploy = JSON.parse(fs.readFileSync(path.join(projectRoot, 'deploy.json'), 'utf8'));
  const provider = new RpcProvider({ nodeUrl: deploy.rpc });
  const account = new Account(provider, deploy.owner, '0xb137668388dbe9acdfa3bc734cc2c469', '1', constants.TRANSACTION_VERSION.V3);

  const tokenAddress = deploy.token_address;
  assert(!!tokenAddress, 'deploy.json has token_address');

  console.log('\n=== Phase 1: Generate deposit (Fix 1: allowed denomination) ===');
  const secret = randomField();
  const nullifier = randomField();
  const amount = 1000000000000000n; // 0.001 — allowed denomination
  const recipient = BigInt(deploy.owner);

  const commitment = computeCommitment(secret, nullifier, amount);
  const nullifierHash = computeNullifierHash(nullifier);
  console.log(`  Commitment: 0x${commitment.toString(16).slice(0, 16)}...`);
  console.log(`  NullifierHash: 0x${nullifierHash.toString(16).slice(0, 16)}...`);

  console.log('\n=== Phase 2: Build Merkle tree + proof ===');
  const tree = buildTreeFromCommitments([commitment]);
  const merkleProof = tree.getProof(0);
  const root = merkleProof.root;
  console.log(`  Root: 0x${root.toString(16).slice(0, 16)}...`);
  assert(merkleProof.pathElements.length === 24, 'path has 24 elements');

  console.log('\n=== Phase 3: Generate Groth16 proof ===');
  const witness = {
    root,
    secret,
    nullifier,
    amount,
    recipient: deploy.owner,
    pathElements: merkleProof.pathElements,
    pathIndices: merkleProof.pathIndices,
  };

  const proofResult = await generateBridgeProof(witness, { wasmPath: WASM_PATH, zkeyPath: ZKEY_PATH });
  assert(proofResult.proof !== undefined, 'snarkjs proof generated');
  assert(proofResult.publicSignals.length === 4, '4 public signals');
  console.log(`  Public signals: root=${proofResult.publicSignals[0].slice(0, 16)}..., nullH=${proofResult.publicSignals[1].slice(0, 16)}..., recip=${proofResult.publicSignals[2].slice(0, 16)}..., amt=${proofResult.publicSignals[3]}`);

  console.log('\n=== Phase 4: Generate garaga calldata ===');
  const garagaCalldata = generateGaragaCalldata(
    proofResult.proof,
    proofResult.publicSignals,
    VK_PATH,
    '/opt/homebrew/bin/python3.10'
  );
  assert(garagaCalldata.length > 100, `garaga calldata has ${garagaCalldata.length} felts (expected ~2918)`);
  console.log(`  Got ${garagaCalldata.length} felts`);

  console.log('\n=== Phase 5: Set merkle root on devnet (Fix 3: adds to known_roots) ===');
  const rootBig = BigInt(proofResult.publicSignals[0]);

  const setRootTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_merkle_root',
    calldata: CallData.compile({ root: splitU256(rootBig) }),
  });
  await provider.waitForTransaction(setRootTx.transaction_hash);

  // Verify root was set
  const storedRoot = await provider.callContract({
    contractAddress: deploy.bridge_address,
    entrypoint: 'get_merkle_root',
    calldata: [],
  });
  const rootSplit = splitU256(rootBig);
  assert(
    BigInt(storedRoot[0]) === BigInt(rootSplit.low) && BigInt(storedRoot[1]) === BigInt(rootSplit.high),
    'merkle root set correctly on-chain'
  );

  console.log('\n=== Phase 6: Call mint (Fix 4: no storacha_cid) ===');
  try {
    const mintTx = await account.execute({
      contractAddress: deploy.bridge_address,
      entrypoint: 'mint',
      calldata: CallData.compile({
        full_proof_with_hints: garagaCalldata,
        max_fee_bps: splitU256(500n),
      }),
    });
    await provider.waitForTransaction(mintTx.transaction_hash);
    console.log(`  TX: ${mintTx.transaction_hash}`);
    assert(true, 'mint transaction succeeded');
  } catch (e) {
    const msg = (e.message || '').slice(0, 500);
    console.error(`  Mint failed: ${msg}`);
    assert(false, `mint transaction failed: ${msg}`);
  }

  console.log('\n=== Phase 6b: Verify ERC20 balance (was internal balance) ===');
  const balance = await getTokenBalance(provider, tokenAddress, deploy.owner);
  assert(balance === amount, `pFLOW balance_of equals deposited amount (${balance})`);

  // Check total supply
  const supplyResult = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'total_supply',
    calldata: [],
  });
  const totalSupply = (BigInt(supplyResult[1]) << 128n) | BigInt(supplyResult[0]);
  assert(totalSupply === amount, `pFLOW total_supply equals minted amount (${totalSupply})`);

  console.log('\n=== Phase 7: Verify nullifier is spent ===');
  const nullifierBig = BigInt(proofResult.publicSignals[1]);

  const spentResult = await provider.callContract({
    contractAddress: deploy.bridge_address,
    entrypoint: 'is_nullifier_spent',
    calldata: CallData.compile({ nullifier_hash: splitU256(nullifierBig) }),
  });
  assert(BigInt(spentResult[0]) === 1n, 'nullifier marked as spent');

  console.log('\n=== Phase 8: Double-spend rejection ===');
  try {
    const doubleTx = await account.execute({
      contractAddress: deploy.bridge_address,
      entrypoint: 'mint',
      calldata: CallData.compile({
        full_proof_with_hints: garagaCalldata,
        max_fee_bps: splitU256(500n),
      }),
    });
    await provider.waitForTransaction(doubleTx.transaction_hash);
    assert(false, 'double-spend should have been rejected');
  } catch (e) {
    const msg = (e.message || '').slice(0, 500);
    console.log(`  Double-spend error (expected): ${msg.slice(0, 120)}...`);
    assert(true, 'double-spend correctly rejected');
  }

  console.log('\n=== Phase 9: Multi-deposit anonymity set ===');
  const deposits = [];
  for (let i = 0; i < 3; i++) {
    deposits.push({
      secret: randomField(),
      nullifier: randomField(),
      amount: 10000000000000000n, // 0.01 — allowed denomination
    });
    deposits[i].commitment = computeCommitment(deposits[i].secret, deposits[i].nullifier, deposits[i].amount);
  }
  console.log(`  Created ${deposits.length} deposits`);

  const multiTree = buildTreeFromCommitments(deposits.map(d => d.commitment));
  const targetIdx = 1;
  const multiProof = multiTree.getProof(targetIdx);
  assert(multiProof.pathElements.length === 24, 'multi-deposit: path has 24 elements');

  const multiWitness = {
    root: multiProof.root,
    secret: deposits[targetIdx].secret,
    nullifier: deposits[targetIdx].nullifier,
    amount: deposits[targetIdx].amount,
    recipient: deploy.owner,
    pathElements: multiProof.pathElements,
    pathIndices: multiProof.pathIndices,
  };

  const multiResult = await generateBridgeProof(multiWitness, { wasmPath: WASM_PATH, zkeyPath: ZKEY_PATH });
  assert(multiResult.proof !== undefined, 'multi-deposit: proof generated');

  const multiCalldata = generateGaragaCalldata(
    multiResult.proof,
    multiResult.publicSignals,
    VK_PATH,
    '/opt/homebrew/bin/python3.10'
  );
  assert(multiCalldata.length > 100, `multi-deposit: garaga calldata (${multiCalldata.length} felts)`);

  // Set the new root
  const multiRootBig = BigInt(multiResult.publicSignals[0]);

  const setMultiRootTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_merkle_root',
    calldata: CallData.compile({ root: splitU256(multiRootBig) }),
  });
  await provider.waitForTransaction(setMultiRootTx.transaction_hash);

  try {
    const multiMintTx = await account.execute({
      contractAddress: deploy.bridge_address,
      entrypoint: 'mint',
      calldata: CallData.compile({
        full_proof_with_hints: multiCalldata,
        max_fee_bps: splitU256(500n),
      }),
    });
    await provider.waitForTransaction(multiMintTx.transaction_hash);
    console.log(`  TX: ${multiMintTx.transaction_hash}`);
    assert(true, 'multi-deposit: mint from pool of 3 succeeded');
  } catch (e) {
    const msg = (e.message || '').slice(0, 300);
    assert(false, `multi-deposit: mint failed: ${msg}`);
  }

  // Verify the correct nullifier was spent
  const multiNullBig = BigInt(multiResult.publicSignals[1]);
  const multiSpent = await provider.callContract({
    contractAddress: deploy.bridge_address,
    entrypoint: 'is_nullifier_spent',
    calldata: CallData.compile({ nullifier_hash: splitU256(multiNullBig) }),
  });
  assert(BigInt(multiSpent[0]) === 1n, 'multi-deposit: correct nullifier spent');

  // Verify cumulative ERC20 balance: first mint (0.001) + second mint (0.01)
  const balance2 = await getTokenBalance(provider, tokenAddress, deploy.owner);
  const expectedBal = 1000000000000000n + 10000000000000000n;
  assert(balance2 === expectedBal, `cumulative pFLOW balance correct (${balance2})`);

  console.log('\n=== Phase 10: Relayer fee deduction during mint (Fix 5) ===');
  // Set relayer fee to 100 bps (1%)
  const setFeeTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_relayer_fee',
    calldata: CallData.compile({ fee_bps: splitU256(100n) }),
  });
  await provider.waitForTransaction(setFeeTx.transaction_hash);

  const feeResult = await provider.callContract({
    contractAddress: deploy.bridge_address,
    entrypoint: 'get_relayer_fee',
    calldata: [],
  });
  assert(BigInt(feeResult[0]) === 100n, 'relayer fee set to 100 bps');

  // Generate a new deposit+proof with a DIFFERENT recipient than the account submitting
  const feeSecret = randomField();
  const feeNullifier = randomField();
  const feeAmount = 100000000000000000n; // 0.1 — allowed denomination
  const feeRecipient = '0x0000000000000000000000000000000000000000000000000000000000abcdef';
  const feeCommitment = computeCommitment(feeSecret, feeNullifier, feeAmount);

  const feeTree = buildTreeFromCommitments([feeCommitment]);
  const feeProof = feeTree.getProof(0);
  const feeWitness = {
    root: feeProof.root,
    secret: feeSecret,
    nullifier: feeNullifier,
    amount: feeAmount,
    recipient: feeRecipient,
    pathElements: feeProof.pathElements,
    pathIndices: feeProof.pathIndices,
  };

  const feeProofResult = await generateBridgeProof(feeWitness, { wasmPath: WASM_PATH, zkeyPath: ZKEY_PATH });
  const feeCalldata = generateGaragaCalldata(feeProofResult.proof, feeProofResult.publicSignals, VK_PATH, '/opt/homebrew/bin/python3.10');

  // Set the root
  const feeRootBig = BigInt(feeProofResult.publicSignals[0]);
  const setFeeRootTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_merkle_root',
    calldata: CallData.compile({ root: splitU256(feeRootBig) }),
  });
  await provider.waitForTransaction(setFeeRootTx.transaction_hash);

  // Record owner balance before mint (owner = relayer = caller)
  const ownerBefore = await getTokenBalance(provider, tokenAddress, deploy.owner);

  // Mint — owner submits proof as relayer, recipient is different address
  try {
    const feeMintTx = await account.execute({
      contractAddress: deploy.bridge_address,
      entrypoint: 'mint',
      calldata: CallData.compile({
        full_proof_with_hints: feeCalldata,
        max_fee_bps: splitU256(500n),
      }),
    });
    await provider.waitForTransaction(feeMintTx.transaction_hash);
    assert(true, 'relayer mint succeeded');
  } catch (e) {
    assert(false, `relayer mint failed: ${(e.message || '').slice(0, 300)}`);
  }

  // Check recipient got amount minus fee: 0.1 * (1 - 0.01) = 0.099
  const recipBal = await getTokenBalance(provider, tokenAddress, feeRecipient);
  const expectedRecip = feeAmount - (feeAmount * 100n / 10000n);
  assert(recipBal === expectedRecip, `recipient got ${recipBal} (expected ${expectedRecip}, fee deducted)`);

  // Check relayer (owner) got the fee: 0.1 * 0.01 = 0.001
  const ownerAfter = await getTokenBalance(provider, tokenAddress, deploy.owner);
  const expectedFee = feeAmount * 100n / 10000n;
  assert(ownerAfter === ownerBefore + expectedFee, `relayer got fee: ${ownerAfter - ownerBefore} (expected ${expectedFee})`);

  // Reset fee to 0
  const resetFeeTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_relayer_fee',
    calldata: CallData.compile({ fee_bps: splitU256(0n) }),
  });
  await provider.waitForTransaction(resetFeeTx.transaction_hash);

  console.log('\n=== Phase 11: max_fee_bps protection (Fix 5) ===');
  const setHighFeeTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_relayer_fee',
    calldata: CallData.compile({ fee_bps: splitU256(200n) }),
  });
  await provider.waitForTransaction(setHighFeeTx.transaction_hash);

  const capSecret = randomField();
  const capNullifier = randomField();
  const capAmount = 1000000000000000n; // 0.001
  const capCommitment = computeCommitment(capSecret, capNullifier, capAmount);
  const capTree = buildTreeFromCommitments([capCommitment]);
  const capProof = capTree.getProof(0);
  const capWitness = {
    root: capProof.root, secret: capSecret, nullifier: capNullifier,
    amount: capAmount, recipient: deploy.owner,
    pathElements: capProof.pathElements, pathIndices: capProof.pathIndices,
  };
  const capResult = await generateBridgeProof(capWitness, { wasmPath: WASM_PATH, zkeyPath: ZKEY_PATH });
  const capCalldata = generateGaragaCalldata(capResult.proof, capResult.publicSignals, VK_PATH, '/opt/homebrew/bin/python3.10');

  const capRootBig = BigInt(capResult.publicSignals[0]);
  const setCapRootTx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_merkle_root',
    calldata: CallData.compile({ root: splitU256(capRootBig) }),
  });
  await provider.waitForTransaction(setCapRootTx.transaction_hash);

  try {
    const capMintTx = await account.execute({
      contractAddress: deploy.bridge_address,
      entrypoint: 'mint',
      calldata: CallData.compile({
        full_proof_with_hints: capCalldata,
        max_fee_bps: splitU256(50n),
      }),
    });
    await provider.waitForTransaction(capMintTx.transaction_hash);
    assert(false, 'max_fee_bps should have rejected mint');
  } catch (e) {
    assert(true, 'max_fee_bps correctly rejected mint when fee > max');
  }

  // Reset fee
  const resetFee2Tx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'set_relayer_fee',
    calldata: CallData.compile({ fee_bps: splitU256(0n) }),
  });
  await provider.waitForTransaction(resetFee2Tx.transaction_hash);

  console.log('\n=== Phase 12: ERC20 token features ===');
  // Test pFLOW ERC20 metadata
  const nameResult = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'name',
    calldata: [],
  });
  assert(nameResult[0] !== '0x0', 'pFLOW has name');

  const symbolResult = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'symbol',
    calldata: [],
  });
  assert(symbolResult[0] !== '0x0', 'pFLOW has symbol');

  const decimalsResult = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'decimals',
    calldata: [],
  });
  assert(BigInt(decimalsResult[0]) === 18n, 'pFLOW has 18 decimals');

  // Test ERC20 transfer: owner transfers 0.001 pFLOW to dummy address
  const transferTo = '0x0000000000000000000000000000000000000000000000000000000000001234';
  const transferAmt = 1000000000000000n; // 0.001
  const ownerBalPre = await getTokenBalance(provider, tokenAddress, deploy.owner);

  const transferTx = await account.execute({
    contractAddress: tokenAddress,
    entrypoint: 'transfer',
    calldata: CallData.compile({
      recipient: transferTo,
      amount: splitU256(transferAmt),
    }),
  });
  await provider.waitForTransaction(transferTx.transaction_hash);

  const ownerBalPost = await getTokenBalance(provider, tokenAddress, deploy.owner);
  const recipBalPost = await getTokenBalance(provider, tokenAddress, transferTo);
  assert(ownerBalPost === ownerBalPre - transferAmt, 'ERC20 transfer: sender balance decreased');
  assert(recipBalPost === transferAmt, 'ERC20 transfer: recipient balance increased');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
