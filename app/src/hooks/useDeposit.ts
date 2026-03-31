'use client';

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { poseidon2 } from 'poseidon-lite';
import {
  PRIVACY_BRIDGE_ADDRESS,
  PRIVACY_BRIDGE_ABI,
} from '@/lib/constants';
import type { NoteData } from '@/lib/encryption';

type DepositStatus = 'idle' | 'generating' | 'ready' | 'locking' | 'confirming' | 'done' | 'error';

// BN254 scalar field prime
const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function randomFieldElement(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let result = 0n;
  for (const b of bytes) {
    result = (result << 8n) + BigInt(b);
  }
  return result % FIELD_PRIME;
}

export function useDeposit() {
  const [noteData, setNoteData] = useState<NoteData | null>(null);
  const [status, setStatus] = useState<DepositStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const { data: hash, writeContract } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const generateNote = useCallback((amount: bigint) => {
    try {
      setStatus('generating');
      setError(null);

      const secret = randomFieldElement();
      const nullifier = randomFieldElement();

      // commitment = poseidon2([poseidon2([secret, nullifier]), amount])
      const innerHash = poseidon2([secret, nullifier]);
      const commitment = poseidon2([innerHash, amount]);
      const nullifierHash = poseidon2([nullifier, nullifier]);

      const note: NoteData = {
        secret: secret.toString(),
        nullifier: nullifier.toString(),
        commitment: commitment.toString(),
        nullifierHash: nullifierHash.toString(),
        amount: amount.toString(),
        timestamp: Date.now(),
      };

      setNoteData(note);
      setStatus('ready');
      return note;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate note');
      setStatus('error');
      return null;
    }
  }, []);

  const lockDeposit = useCallback(
    (commitment: bigint, amount: bigint) => {
      try {
        setStatus('locking');
        setError(null);

        writeContract(
          {
            address: PRIVACY_BRIDGE_ADDRESS,
            abi: PRIVACY_BRIDGE_ABI,
            functionName: 'lock',
            args: [commitment],
            value: amount,
          },
          {
            onSuccess: () => {
              setStatus('confirming');
            },
            onError: (err: Error) => {
              setError(err.message);
              setStatus('error');
            },
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to lock deposit');
        setStatus('error');
      }
    },
    [writeContract]
  );

  // Update status when confirmed
  if (isConfirmed && status === 'confirming') {
    setStatus('done');
  }

  return {
    generateNote,
    lockDeposit,
    noteData,
    status,
    error,
    txHash: hash,
    isConfirming,
    isConfirmed,
  };
}
