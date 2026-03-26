export interface ProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
  };
  publicSignals: string[];
  nullifierHash: string;
}

// snarkjs accepts a flexible witness type — arrays and numbers are valid
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CircuitInput = Record<string, any>;

export async function generateProof(
  witness: CircuitInput
): Promise<ProofResult> {
  const snarkjs = await import('snarkjs');

  const wasmPath = '/bridge.wasm';
  const zkeyPath = '/bridge_final.zkey';

  const result = await snarkjs.groth16.fullProve(
    witness,
    wasmPath,
    zkeyPath
  );

  const proof = result.proof as ProofResult['proof'];
  const publicSignals = result.publicSignals;
  // publicSignals[1] is the nullifierHash per our circuit
  const nullifierHash = publicSignals[1];

  return { proof, publicSignals, nullifierHash };
}

export async function verifyProof(
  proof: ProofResult['proof'],
  publicSignals: string[]
): Promise<boolean> {
  const snarkjs = await import('snarkjs');

  const vkeyResponse = await fetch('/verification_key.json');
  const vkey = await vkeyResponse.json();

  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}
