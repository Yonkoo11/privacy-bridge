/**
 * Incremental Merkle Tree — depth 24, Poseidon hash.
 * Matches MerkleTreeChecker in bridge.circom exactly.
 * Adapted from Cipher Pol's merkle-tree.ts.
 */
import { poseidonHash } from './poseidon.mjs';

export const TREE_DEPTH = 24;

// Precomputed zero values: zeros[0] = H(0,0), zeros[k] = H(zeros[k-1], zeros[k-1])
export const ZERO_VALUES = (() => {
  const z = new Array(TREE_DEPTH + 1);
  z[0] = poseidonHash(0n, 0n);
  for (let i = 1; i <= TREE_DEPTH; i++) {
    z[i] = poseidonHash(z[i - 1], z[i - 1]);
  }
  return Object.freeze(z);
})();

export class IncrementalMerkleTree {
  constructor(depth = TREE_DEPTH) {
    this.depth = depth;
    this.filledSubtrees = ZERO_VALUES.slice(0, depth);
    this.leaves = [];
    this.nextIndex = 0;
    this._root = ZERO_VALUES[depth];
  }

  insert(leaf) {
    if (this.nextIndex >= 2 ** this.depth) throw new Error('Tree full');

    this.leaves.push(leaf);
    let currentIndex = this.nextIndex;
    let currentHash = leaf;

    for (let level = 0; level < this.depth; level++) {
      if (currentIndex % 2 === 0) {
        this.filledSubtrees[level] = currentHash;
        currentHash = poseidonHash(currentHash, ZERO_VALUES[level]);
      } else {
        currentHash = poseidonHash(this.filledSubtrees[level], currentHash);
      }
      currentIndex >>= 1;
    }

    this._root = currentHash;
    this.nextIndex++;
    return this._root;
  }

  getProof(index) {
    if (index >= this.leaves.length) {
      throw new Error(`Leaf ${index} not found (tree has ${this.leaves.length} leaves)`);
    }

    const pathElements = [];
    const pathIndices = [];

    // Rebuild tree to get correct siblings
    const tempTree = new IncrementalMerkleTree(this.depth);
    for (let i = 0; i < this.leaves.length; i++) {
      tempTree.insert(this.leaves[i]);
    }

    // Extract path using full leaf set
    const cache = new Map();
    let currentIndex = index;
    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2 === 1;
      pathIndices.push(isRight ? 1 : 0);

      const siblingIdx = isRight ? currentIndex - 1 : currentIndex + 1;
      pathElements.push(this._getSubtreeHash(level, siblingIdx, cache));

      currentIndex >>= 1;
    }

    return {
      leaf: this.leaves[index],
      pathElements,
      pathIndices,
      root: this._root,
      index,
    };
  }

  _getSubtreeHash(level, position, cache) {
    const key = `${level}:${position}`;
    if (cache.has(key)) return cache.get(key);

    // Early termination: if the entire subtree is empty, return precomputed zero
    const startLeaf = position * (1 << level);
    if (startLeaf >= this.leaves.length) {
      return ZERO_VALUES[level];
    }

    let result;
    if (level === 0) {
      result = position < this.leaves.length ? this.leaves[position] : ZERO_VALUES[0];
    } else {
      const left = this._getSubtreeHash(level - 1, position * 2, cache);
      const right = this._getSubtreeHash(level - 1, position * 2 + 1, cache);
      result = poseidonHash(left, right);
    }

    cache.set(key, result);
    return result;
  }

  root() { return this._root; }
  get size() { return this.nextIndex; }

  findLeaf(commitment) {
    return this.leaves.indexOf(commitment);
  }
}

export function buildTreeFromCommitments(commitments, depth = TREE_DEPTH) {
  const tree = new IncrementalMerkleTree(depth);
  for (const c of commitments) tree.insert(c);
  return tree;
}
