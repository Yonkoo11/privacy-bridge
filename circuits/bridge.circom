pragma circom 2.2.0;

include "./circomlib/poseidon.circom";
include "./circomlib/bitify.circom";
include "./circomlib/comparators.circom";

/**
 * Privacy Bridge Circuit — Groth16 over BN254
 *
 * Proves: "I know a (secret, nullifier, amount) tuple whose commitment
 *          is in the Merkle tree with this root, and I haven't spent it."
 *
 * Public inputs (4):
 *   root            — Merkle root of all commitments on Flow
 *   nullifierHash   — H(nullifier, nullifier), prevents double-spend
 *   recipient       — Starknet address receiving shielded tokens
 *   amount          — withdrawal amount (matches deposit)
 *
 * Private inputs:
 *   secret          — random secret chosen at deposit time
 *   nullifier       — random nullifier chosen at deposit time
 *   pathElements[24] — Merkle siblings (bottom to top)
 *   pathIndices[24]  — direction bits (0=left, 1=right)
 */

template Poseidon2() {
    signal input inputs[2];
    signal output out;

    component poseidon = Poseidon(2);
    poseidon.inputs <== inputs;
    out <== poseidon.out;
}

// Merkle tree membership proof checker
template MerkleTreeChecker(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    component hashers[depth];

    signal hashes[depth + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // Verify path index is binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = Poseidon2();

        // If pathIndices[i] == 0: hash(current, sibling)
        // If pathIndices[i] == 1: hash(sibling, current)
        hashers[i].inputs[0] <== hashes[i] + (pathElements[i] - hashes[i]) * pathIndices[i];
        hashers[i].inputs[1] <== pathElements[i] + (hashes[i] - pathElements[i]) * pathIndices[i];

        hashes[i + 1] <== hashers[i].out;
    }

    root === hashes[depth];
}

// Commitment hasher: commitment = H(H(secret, nullifier), amount)
template CommitmentHasher() {
    signal input secret;
    signal input nullifier;
    signal input amount;
    signal output commitment;
    signal output nullifierHash;

    // commitment = H(H(secret, nullifier), amount)
    component innerHash = Poseidon2();
    innerHash.inputs[0] <== secret;
    innerHash.inputs[1] <== nullifier;

    component outerHash = Poseidon2();
    outerHash.inputs[0] <== innerHash.out;
    outerHash.inputs[1] <== amount;

    commitment <== outerHash.out;

    // nullifierHash = H(nullifier, nullifier)
    component nullHash = Poseidon2();
    nullHash.inputs[0] <== nullifier;
    nullHash.inputs[1] <== nullifier;

    nullifierHash <== nullHash.out;
}

template PrivacyBridge(depth) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input amount;

    // Private inputs
    signal input secret;
    signal input nullifier;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // 1. Compute commitment and nullifier hash
    component hasher = CommitmentHasher();
    hasher.secret <== secret;
    hasher.nullifier <== nullifier;
    hasher.amount <== amount;

    // 2. Verify nullifier hash matches public input
    hasher.nullifierHash === nullifierHash;

    // 3. Verify commitment is in the Merkle tree
    component tree = MerkleTreeChecker(depth);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    tree.pathElements <== pathElements;
    tree.pathIndices <== pathIndices;

    // 4. Square recipient to add it as a constraint
    // (prevents malleability — proof is bound to this recipient)
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
}

// Instantiate with depth 24 (16M+ deposits)
component main {public [root, nullifierHash, recipient, amount]} = PrivacyBridge(24);
