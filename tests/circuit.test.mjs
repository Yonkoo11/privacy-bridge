/**
 * Circuit unit tests — verify bridge.circom works with snarkjs.
 *
 * Tests:
 * 1. Single deposit: generate commitment, build tree, prove membership
 * 2. Multiple deposits: prove correct deposit in a tree of 5
 * 3. Wrong secret: proof should fail
 */
import { poseidonHash, computeCommitment, computeNullifierHash } from '../sdk/src/poseidon.mjs';
import { IncrementalMerkleTree } from '../sdk/src/merkle.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WASM_PATH = path.join(__dirname, '..', 'circuits', 'target', 'bridge_js', 'bridge.wasm');
const ZKEY_PATH = path.join(__dirname, '..', 'circuits', 'target', 'bridge_final.zkey');

function randomField() {
  return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
}

let snarkjs;
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL: ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function main() {
  if (!fs.existsSync(WASM_PATH)) {
    console.log('Circuit not compiled. Run: bash circuits/setup.sh');
    process.exit(1);
  }

  snarkjs = await import('snarkjs');
  console.log('\nCircuit Tests\n');

  // Test 1: Single deposit proof
  await test('Single deposit — prove membership', async () => {
    const secret = randomField();
    const nullifier = randomField();
    const amount = 1000000000000000000n; // 1 FLOW in wei
    const recipient = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

    const commitment = computeCommitment(secret, nullifier, amount);
    const nullifierHash = computeNullifierHash(nullifier);

    const tree = new IncrementalMerkleTree();
    tree.insert(commitment);

    const merkleProof = tree.getProof(0);

    const input = {
      root: merkleProof.root.toString(),
      nullifierHash: nullifierHash.toString(),
      recipient: BigInt(recipient).toString(),
      amount: amount.toString(),
      secret: secret.toString(),
      nullifier: nullifier.toString(),
      pathElements: merkleProof.pathElements.map(String),
      pathIndices: merkleProof.pathIndices,
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
    const vk = await snarkjs.zKey.exportVerificationKey(ZKEY_PATH);
    const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);

    assert(valid, 'Proof should verify');
    assert(publicSignals[0] === merkleProof.root.toString(), 'Root mismatch');
    assert(publicSignals[1] === nullifierHash.toString(), 'NullifierHash mismatch');
  });

  // Test 2: Multiple deposits — prove specific one
  await test('Multiple deposits — prove leaf index 2', async () => {
    const deposits = [];
    const tree = new IncrementalMerkleTree();

    for (let i = 0; i < 5; i++) {
      const s = randomField();
      const n = randomField();
      const a = BigInt(i + 1) * 1000000000000000000n;
      const c = computeCommitment(s, n, a);
      deposits.push({ secret: s, nullifier: n, amount: a, commitment: c });
      tree.insert(c);
    }

    const targetIdx = 2;
    const d = deposits[targetIdx];
    const merkleProof = tree.getProof(targetIdx);
    const nullifierHash = computeNullifierHash(d.nullifier);
    const recipient = '0x1234567890abcdef1234567890abcdef12345678';

    const input = {
      root: merkleProof.root.toString(),
      nullifierHash: nullifierHash.toString(),
      recipient: BigInt(recipient).toString(),
      amount: d.amount.toString(),
      secret: d.secret.toString(),
      nullifier: d.nullifier.toString(),
      pathElements: merkleProof.pathElements.map(String),
      pathIndices: merkleProof.pathIndices,
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
    const vk = await snarkjs.zKey.exportVerificationKey(ZKEY_PATH);
    const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);

    assert(valid, 'Proof should verify');
  });

  // Test 3: Wrong secret should fail witness generation
  await test('Wrong secret — should fail', async () => {
    const secret = randomField();
    const nullifier = randomField();
    const amount = 1000000000000000000n;
    const commitment = computeCommitment(secret, nullifier, amount);
    const nullifierHash = computeNullifierHash(nullifier);

    const tree = new IncrementalMerkleTree();
    tree.insert(commitment);
    const merkleProof = tree.getProof(0);

    const wrongSecret = randomField();
    const input = {
      root: merkleProof.root.toString(),
      nullifierHash: nullifierHash.toString(),
      recipient: '12345',
      amount: amount.toString(),
      secret: wrongSecret.toString(), // WRONG
      nullifier: nullifier.toString(),
      pathElements: merkleProof.pathElements.map(String),
      pathIndices: merkleProof.pathIndices,
    };

    let threw = false;
    try {
      await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
    } catch {
      threw = true;
    }

    assert(threw, 'Should fail with wrong secret');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
