'use client';

import { useState, useCallback } from 'react';
import { generateProof as generateSnarkProof } from '@/lib/prover';
import { RELAYER_URL, CALLDATA_URL } from '@/lib/constants';
import type { NoteData } from '@/lib/encryption';

const CHAIN_ID_TO_KEY: Record<number, string> = {
  545: 'flow-evm',
  11155111: 'sepolia',
  84532: 'base-sepolia',
  421614: 'arbitrum-sepolia',
  11155420: 'optimism-sepolia',
};

type WithdrawStatus =
  | 'idle'
  | 'loaded'
  | 'proving'
  | 'proved'
  | 'fetching_calldata'
  | 'calldata_ready'
  | 'relaying'
  | 'done'
  | 'error';

interface ProofData {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
  };
  publicSignals: string[];
  nullifierHash: string;
}

interface CalldataResult {
  calldata: string[];
  max_fee_bps: number;
}

export function useWithdraw() {
  const [note, setNote] = useState<NoteData | null>(null);
  const [status, setStatus] = useState<WithdrawStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [calldata, setCalldata] = useState<CalldataResult | null>(null);
  const [relayTxHash, setRelayTxHash] = useState<string | null>(null);

  const loadNote = useCallback((noteData: NoteData) => {
    setNote(noteData);
    setStatus('loaded');
    setError(null);
  }, []);

  const generateProof = useCallback(
    async (recipient: string, merkleProof: { pathElements: string[]; pathIndices: number[]; root: string }) => {
      if (!note) {
        setError('No note loaded');
        return;
      }

      try {
        setStatus('proving');
        setError(null);

        const witness = {
          // Private inputs
          secret: note.secret,
          nullifier: note.nullifier,
          pathElements: merkleProof.pathElements,
          pathIndices: merkleProof.pathIndices,
          // Public inputs
          root: merkleProof.root,
          recipient,
          amount: note.amount,
        };

        const result = await generateSnarkProof(witness);
        setProofData(result);
        setStatus('proved');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Proof generation failed');
        setStatus('error');
      }
    },
    [note]
  );

  const getCalldata = useCallback(async () => {
    if (!proofData) {
      setError('No proof available');
      return;
    }

    try {
      setStatus('fetching_calldata');
      setError(null);

      const response = await fetch(`${CALLDATA_URL}/calldata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: proofData.proof,
          publicSignals: proofData.publicSignals,
        }),
      });

      if (!response.ok) {
        throw new Error(`Calldata proxy returned ${response.status}`);
      }

      const data = await response.json();
      // Fetch current relayer fee to set max_fee_bps with some buffer
      let maxFeeBps = 500; // default 5% cap
      try {
        const feeRes = await fetch(`${RELAYER_URL}/fee`);
        if (feeRes.ok) {
          const feeData = await feeRes.json();
          // Set max to 2x current fee as buffer for fluctuations
          maxFeeBps = Math.max(feeData.fee_bps * 2, 100);
        }
      } catch {
        // Use default cap
      }
      setCalldata({ calldata: data.calldata, max_fee_bps: maxFeeBps });
      setStatus('calldata_ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get calldata');
      setStatus('error');
    }
  }, [proofData]);

  const submitRelay = useCallback(async () => {
    if (!calldata) {
      setError('No calldata available');
      return;
    }

    try {
      setStatus('relaying');
      setError(null);

      const response = await fetch(`${RELAYER_URL}/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calldata: calldata.calldata,
          max_fee_bps: calldata.max_fee_bps,
          sourceChain: CHAIN_ID_TO_KEY[note?.sourceChainId ?? 545] ?? 'flow-evm',
        }),
      });

      if (!response.ok) {
        throw new Error(`Relayer returned ${response.status}`);
      }

      const data = await response.json();
      setRelayTxHash(data.txHash || data.transaction_hash);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Relay submission failed');
      setStatus('error');
    }
  }, [calldata, note]);

  return {
    loadNote,
    generateProof,
    getCalldata,
    submitRelay,
    note,
    status,
    error,
    proofData,
    calldata,
    relayTxHash,
  };
}
