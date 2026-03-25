/**
 * Poseidon hash — BN254 Fr field, t=3, matching circomlib Poseidon(2).
 * Same parameters verified in Cipher Pol: poseidon2([0n, 0n]) matches Ekubo's zero constant.
 */
import { poseidon2 } from 'poseidon-lite';

export function poseidonHash(a, b) {
  return poseidon2([a, b]);
}

/**
 * Commitment = H(H(secret, nullifier), amount)
 * Matches CommitmentHasher in bridge.circom.
 */
export function computeCommitment(secret, nullifier, amount) {
  const temp = poseidonHash(secret, nullifier);
  return poseidonHash(temp, amount);
}

/**
 * NullifierHash = H(nullifier, nullifier)
 * Matches HashOne pattern — prevents double-spend without revealing which deposit.
 */
export function computeNullifierHash(nullifier) {
  return poseidonHash(nullifier, nullifier);
}
