'use client';

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { poseidon2 } from 'poseidon-lite';
import { getBridgeAddress, PRIVACY_BRIDGE_ABI } from '@/lib/constants';
import type { NoteData } from '@/lib/encryption';

type DepositStatus = 'idle' | 'generating' | 'ready' | 'locking' | 'confirming' | 'done' | 'error';

const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const ALLOWED_DENOMINATIONS = new Set([
  100000000000000n,     // 0.0001
  1000000000000000n,    // 0.001
  10000000000000000n,   // 0.01
  100000000000000000n,  // 0.1
]);

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

  const generateNote = useCallback((amount: bigint, sourceChainId?: number) => {
    try {
      setStatus('generating');
      setError(null);

      const secret = randomFieldElement();
      const nullifier = randomFieldElement();

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
        sourceChainId,
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
    (commitment: bigint, amount: bigint, chainId?: number) => {
      try {
        setStatus('locking');
        setError(null);

        if (!ALLOWED_DENOMINATIONS.has(amount)) {
          setError(`Invalid denomination: ${amount}. Use 0.0001, 0.001, 0.01, or 0.1`);
          setStatus('error');
          return;
        }

        const bridgeAddress = getBridgeAddress(chainId ?? 545);
        if (!bridgeAddress) {
          setError('Bridge not deployed on this chain');
          setStatus('error');
          return;
        }

        writeContract(
          {
            address: bridgeAddress,
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
