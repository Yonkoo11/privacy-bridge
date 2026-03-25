/**
 * Groth16 Prover for Privacy Bridge
 *
 * Generates ZK proof that a commitment exists in the Merkle tree.
 *
 * Public inputs (4): root, nullifierHash, recipient, amount
 * Private inputs: secret, nullifier, pathElements[24], pathIndices[24]
 *
 * NOTE: snarkjs outputs proof coordinates as DECIMAL strings.
 * Do NOT prepend "0x" -- BigInt("0x" + decimalString) silently produces wrong values.
 */
import { computeNullifierHash } from './poseidon.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

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

  // Build circuit input signals -- names match bridge.circom exactly
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

  // Local verification before anything else
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
 * Generate garaga calldata (full_proof_with_hints) from a snarkjs proof.
 *
 * This calls garaga 1.0.1's Python API to produce the ~2918-felt calldata
 * that the on-chain garaga verifier expects. Raw u256 splits do NOT work
 * with garaga verifiers -- they need MSM hints and digit decompositions.
 *
 * @param {object} proof - snarkjs proof object (pi_a, pi_b, pi_c)
 * @param {string[]} publicSignals - snarkjs public signals
 * @param {string} vkPath - path to verification_key.json
 * @param {string} pythonPath - path to python3.10 binary
 * @returns {string[]} - garaga calldata as string array
 */
export function generateGaragaCalldata(proof, publicSignals, vkPath, pythonPath = '/opt/homebrew/bin/python3.10') {
  const tag = crypto.randomUUID();
  const tmpDir = os.tmpdir();
  const proofPath = path.join(tmpDir, `bridge-proof-${tag}.json`);
  const pubPath = path.join(tmpDir, `bridge-pub-${tag}.json`);
  const cdOutPath = path.join(tmpDir, `bridge-cd-${tag}.json`);

  fs.writeFileSync(proofPath, JSON.stringify(proof));
  fs.writeFileSync(pubPath, JSON.stringify(publicSignals));

  const pyScript = [
    'import sys, json',
    'from garaga.starknet.groth16_contract_generator.calldata import groth16_calldata_from_vk_and_proof',
    'from garaga.starknet.groth16_contract_generator.parsing_utils import Groth16Proof, Groth16VerifyingKey',
    `vk = Groth16VerifyingKey.from_json('${vkPath}')`,
    `proof = Groth16Proof.from_json(proof_path='${proofPath}', public_inputs_path='${pubPath}')`,
    'calldata = groth16_calldata_from_vk_and_proof(vk, proof)',
    `json.dump([str(x) for x in calldata], open('${cdOutPath}', 'w'))`,
    'print(len(calldata))',
  ].join('\n');

  const pyPath = path.join(tmpDir, `bridge-garaga-${tag}.py`);
  fs.writeFileSync(pyPath, pyScript);

  try {
    const lenStr = execFileSync(pythonPath, [pyPath], {
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    }).trim();

    const numFelts = parseInt(lenStr, 10);
    if (isNaN(numFelts) || numFelts < 30) {
      throw new Error(`garaga returned ${numFelts} felts, expected ~2918`);
    }

    const calldata = JSON.parse(fs.readFileSync(cdOutPath, 'utf8'));
    // garaga prepends a length prefix [len, data...] for raw calldata use.
    // When passing through CallData.compile (which adds its own ABI length prefix
    // for Span<felt252>), we must strip garaga's prefix to avoid double-encoding.
    if (calldata.length > 1 && parseInt(calldata[0], 10) === calldata.length - 1) {
      return calldata.slice(1);
    }
    return calldata;
  } finally {
    // Clean up temp files
    for (const f of [proofPath, pubPath, pyPath, cdOutPath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}
