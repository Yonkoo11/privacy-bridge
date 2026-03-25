/**
 * Groth16 Prover for Privacy Bridge
 *
 * Generates ZK proof that a commitment exists in the Merkle tree.
 *
 * Public inputs (4): root, nullifierHash, recipient, amount
 * Private inputs: secret, nullifier, pathElements[24], pathIndices[24]
 *
 * NOTE: snarkjs outputs proof coordinates as DECIMAL strings.
 * Do NOT prepend "0x" — BigInt("0x" + decimalString) silently produces wrong values.
 */
import { computeNullifierHash } from './poseidon.mjs';

/**
 * Generate a Groth16 bridge proof.
 * @param {object} witness - { secret, nullifier, amount, recipient, pathElements, pathIndices, root }
 * @param {object} artifacts - { wasmPath, zkeyPath }
 */
export async function generateBridgeProof(witness, artifacts) {
  const snarkjs = await import('snarkjs');

  const nullifierHash = computeNullifierHash(witness.nullifier);

  if (witness.pathElements.length !== 24) {
    throw new Error(`pathElements must have 24 elements, got ${witness.pathElements.length}`);
  }

  // Build circuit input signals — names match bridge.circom exactly
  const input = {
    root: witness.root.toString(),
    nullifierHash: nullifierHash.toString(),
    recipient: BigInt(witness.recipient).toString(),
    amount: witness.amount.toString(),
    secret: witness.secret.toString(),
    nullifier: witness.nullifier.toString(),
    pathElements: witness.pathElements.map(String),
    pathIndices: witness.pathIndices,
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    artifacts.wasmPath,
    artifacts.zkeyPath
  );

  // Local verification before serializing
  const vk = await snarkjs.zKey.exportVerificationKey(artifacts.zkeyPath);
  const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);
  if (!valid) {
    throw new Error(
      'Proof failed local verification. Re-run: bash circuits/setup.sh'
    );
  }

  return {
    proof,
    publicSignals,
    nullifierHash,
  };
}

/**
 * Serialize proof to felt252 array for garaga on Starknet.
 * Format: [a.x.low, a.x.high, a.y.low, a.y.high,
 *          b.x0.low, b.x0.high, b.x1.low, b.x1.high,
 *          b.y0.low, b.y0.high, b.y1.low, b.y1.high,
 *          c.x.low, c.x.high, c.y.low, c.y.high,
 *          ...public_inputs as u256 pairs...]
 */
export function serializeProofToFelts(proof, publicSignals) {
  function u256ToFelts(value) {
    const low = value & ((1n << 128n) - 1n);
    const high = value >> 128n;
    return [low, high];
  }

  const felts = [];

  // pi_a: G1 point (x, y) — DECIMAL strings from snarkjs
  for (const coord of [proof.pi_a[0], proof.pi_a[1]]) {
    felts.push(...u256ToFelts(BigInt(coord)));
  }

  // pi_b: G2 point — Fq2 elements
  for (const pair of [proof.pi_b[0], proof.pi_b[1]]) {
    for (const coord of pair) {
      felts.push(...u256ToFelts(BigInt(coord)));
    }
  }

  // pi_c: G1 point (x, y)
  for (const coord of [proof.pi_c[0], proof.pi_c[1]]) {
    felts.push(...u256ToFelts(BigInt(coord)));
  }

  // Public signals (4 for bridge.circom: root, nullifierHash, recipient, amount)
  for (const signal of publicSignals) {
    felts.push(...u256ToFelts(BigInt(signal)));
  }

  return felts;
}
