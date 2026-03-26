import { poseidon2 } from 'poseidon-lite';

const TREE_DEPTH = 24;

// Precomputed zero values matching sdk/src/merkle.mjs exactly:
// z[0] = poseidon2([0, 0]), z[k] = poseidon2([z[k-1], z[k-1]])
function computeZeroValues(): bigint[] {
  const z: bigint[] = new Array(TREE_DEPTH + 1);
  z[0] = poseidon2([0n, 0n]);
  for (let i = 1; i <= TREE_DEPTH; i++) {
    z[i] = poseidon2([z[i - 1], z[i - 1]]);
  }
  return z;
}

const ZERO_VALUES = computeZeroValues();

/**
 * Compute subtree hash at a given level and position.
 * Mirrors sdk/src/merkle.mjs _getSubtreeHash exactly.
 */
function getSubtreeHash(
  level: number,
  position: number,
  leaves: bigint[],
  cache: Map<string, bigint>
): bigint {
  const key = `${level}:${position}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  // If entire subtree is empty, return precomputed zero
  const startLeaf = position * (1 << level);
  if (startLeaf >= leaves.length) {
    return ZERO_VALUES[level];
  }

  let result: bigint;
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

/**
 * Build a merkle tree from commitment strings and return the proof for a given leaf.
 * Uses the same recursive subtree algorithm as sdk/src/merkle.mjs.
 */
export function buildMerkleTree(
  commitments: string[],
  leafIndex: number
): { root: string; pathElements: string[]; pathIndices: number[] } {
  const leaves = commitments.map((c) => BigInt(c));
  const cache = new Map<string, bigint>();

  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let currentIndex = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const isRight = currentIndex % 2 === 1;
    pathIndices.push(isRight ? 1 : 0);

    const siblingIdx = isRight ? currentIndex - 1 : currentIndex + 1;
    pathElements.push(getSubtreeHash(level, siblingIdx, leaves, cache).toString());

    currentIndex >>= 1;
  }

  // Compute root: hash the two halves at the top level
  // Root = H(subtree(depth-1, pos=0), subtree(depth-1, pos=1))
  // This is equivalent to getSubtreeHash(TREE_DEPTH, 0, ...) if we extended the function
  const leftHalf = getSubtreeHash(TREE_DEPTH - 1, 0, leaves, cache);
  const rightHalf = getSubtreeHash(TREE_DEPTH - 1, 1, leaves, cache);
  const root = poseidon2([leftHalf, rightHalf]);

  return {
    root: root.toString(),
    pathElements,
    pathIndices,
  };
}
