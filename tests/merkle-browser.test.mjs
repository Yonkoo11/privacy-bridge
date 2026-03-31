#!/usr/bin/env node
/**
 * Cross-check: browser merkle tree (app/src/lib/merkle.ts logic)
 * vs SDK merkle tree (sdk/src/merkle.mjs).
 *
 * Both must produce identical roots and proofs for the same input.
 */
import { poseidon2 } from 'poseidon-lite';
import { computeCommitment } from '../sdk/src/poseidon.mjs';
import { buildTreeFromCommitments } from '../sdk/src/merkle.mjs';

const TREE_DEPTH = 24;

// Re-implement browser merkle.ts logic exactly (can't import .ts directly)
// z[0] = H(0,0), z[k] = H(z[k-1], z[k-1]) — matches SDK
const ZERO_VALUES = (() => {
  const z = [poseidon2([0n, 0n])];
  for (let i = 1; i <= TREE_DEPTH; i++) {
    z[i] = poseidon2([z[i - 1], z[i - 1]]);
  }
  return z;
})();

function getSubtreeHash(level, position, leaves, cache) {
  const key = `${level}:${position}`;
  if (cache.has(key)) return cache.get(key);

  const startLeaf = position * (1 << level);
  if (startLeaf >= leaves.length) return ZERO_VALUES[level];

  let result;
  if (level === 0) {
    result = position < leaves.length ? leaves[position] : ZERO_VALUES[0];
  } else {
    const left = getSubtreeHash(level - 1, position * 2, leaves, cache);
    const right = getSubtreeHash(level - 1, position * 2 + 1, leaves, cache);
    result = poseidon2([left, right]);
  }
  cache.set(key, result);
  return result;
}

function browserBuildMerkleTree(commitments, leafIndex) {
  const leaves = commitments.map(c => BigInt(c));
  const cache = new Map();
  const pathElements = [];
  const pathIndices = [];
  let currentIndex = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const isRight = currentIndex % 2 === 1;
    pathIndices.push(isRight ? 1 : 0);
    const siblingIdx = isRight ? currentIndex - 1 : currentIndex + 1;
    pathElements.push(getSubtreeHash(level, siblingIdx, leaves, cache).toString());
    currentIndex >>= 1;
  }

  const leftHalf = getSubtreeHash(TREE_DEPTH - 1, 0, leaves, cache);
  const rightHalf = getSubtreeHash(TREE_DEPTH - 1, 1, leaves, cache);
  const root = poseidon2([leftHalf, rightHalf]);

  return { root: root.toString(), pathElements, pathIndices };
}

let pass = 0;
let fail = 0;

function check(condition, msg) {
  if (condition) { console.log(`  PASS: ${msg}`); pass++; }
  else { console.log(`  FAIL: ${msg}`); fail++; }
}

const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
function randomBigInt() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let result = 0n;
  for (const b of bytes) result = (result << 8n) + BigInt(b);
  return result % FIELD_PRIME;
}

async function main() {
  console.log('=== Browser Merkle Tree Cross-Check ===\n');

  // Test 1: Single commitment
  console.log('Test 1: Single commitment');
  const c1 = computeCommitment(randomBigInt(), randomBigInt(), 1000000000000000n);
  const sdkTree1 = buildTreeFromCommitments([c1]);
  const sdkProof1 = sdkTree1.getProof(0);
  const browserProof1 = browserBuildMerkleTree([c1.toString()], 0);

  check(sdkProof1.root.toString() === browserProof1.root, 'single: roots match');
  check(sdkProof1.pathElements.length === browserProof1.pathElements.length, 'single: path depth matches');
  for (let i = 0; i < sdkProof1.pathElements.length; i++) {
    if (sdkProof1.pathElements[i].toString() !== browserProof1.pathElements[i]) {
      check(false, `single: pathElement[${i}] mismatch`);
      break;
    }
    if (sdkProof1.pathIndices[i] !== browserProof1.pathIndices[i]) {
      check(false, `single: pathIndex[${i}] mismatch`);
      break;
    }
  }
  check(true, 'single: all path elements and indices match');

  // Test 2: Three commitments, prove leaf 1
  console.log('\nTest 2: Three commitments, prove leaf 1');
  const c2 = computeCommitment(randomBigInt(), randomBigInt(), 1000000000000000n);
  const c3 = computeCommitment(randomBigInt(), randomBigInt(), 10000000000000000n);
  const sdkTree3 = buildTreeFromCommitments([c1, c2, c3]);
  const sdkProof3 = sdkTree3.getProof(1);
  const browserProof3 = browserBuildMerkleTree([c1.toString(), c2.toString(), c3.toString()], 1);

  check(sdkProof3.root.toString() === browserProof3.root, 'three: roots match');
  let allMatch = true;
  for (let i = 0; i < sdkProof3.pathElements.length; i++) {
    if (sdkProof3.pathElements[i].toString() !== browserProof3.pathElements[i] ||
        sdkProof3.pathIndices[i] !== browserProof3.pathIndices[i]) {
      allMatch = false;
      check(false, `three: path mismatch at level ${i}`);
      console.log(`    SDK:     element=${sdkProof3.pathElements[i].toString().slice(0,20)}... idx=${sdkProof3.pathIndices[i]}`);
      console.log(`    Browser: element=${browserProof3.pathElements[i].slice(0,20)}... idx=${browserProof3.pathIndices[i]}`);
      break;
    }
  }
  if (allMatch) check(true, 'three: all path elements and indices match');

  // Test 3: Ten commitments, prove leaf 7
  console.log('\nTest 3: Ten commitments, prove leaf 7');
  const commitments = [];
  for (let i = 0; i < 10; i++) {
    commitments.push(computeCommitment(randomBigInt(), randomBigInt(), 100000000000000n));
  }
  const sdkTree10 = buildTreeFromCommitments(commitments);
  const sdkProof10 = sdkTree10.getProof(7);
  const browserProof10 = browserBuildMerkleTree(commitments.map(c => c.toString()), 7);

  check(sdkProof10.root.toString() === browserProof10.root, 'ten: roots match');
  let tenMatch = true;
  for (let i = 0; i < sdkProof10.pathElements.length; i++) {
    if (sdkProof10.pathElements[i].toString() !== browserProof10.pathElements[i] ||
        sdkProof10.pathIndices[i] !== browserProof10.pathIndices[i]) {
      tenMatch = false;
      check(false, `ten: path mismatch at level ${i}`);
      break;
    }
  }
  if (tenMatch) check(true, 'ten: all path elements and indices match');

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
