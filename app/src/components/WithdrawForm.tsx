'use client';

import { useState, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { useWithdraw } from '@/hooks/useWithdraw';
import { getBridgeAddress, PRIVACY_BRIDGE_ABI } from '@/lib/constants';
import { getChainConfig } from '@/lib/chains';
import { buildMerkleTree } from '@/lib/merkle';
import type { NoteData } from '@/lib/encryption';

const STEPS = [
  'Load Note',
  'Generate Proof',
  'Get Calldata',
  'Submit via Relayer',
] as const;

export default function WithdrawForm() {
  const {
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
  } = useWithdraw();

  const [noteInput, setNoteInput] = useState('');
  const [recipient, setRecipient] = useState('');
  const isValidRecipient = recipient.startsWith('0x') && recipient.length >= 42;
  const [treeError, setTreeError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const publicClient = usePublicClient();

  const currentStep =
    status === 'idle'
      ? 0
      : status === 'loaded'
        ? 1
        : status === 'proving' || status === 'proved'
          ? 2
          : status === 'fetching_calldata' || status === 'calldata_ready'
            ? 3
            : status === 'done'
              ? 4
              : -1;

  const handlePasteNote = () => {
    try {
      const parsed: NoteData = JSON.parse(noteInput);
      if (!parsed.secret || !parsed.nullifier || !parsed.amount || !parsed.commitment) {
        throw new Error('Invalid note format');
      }
      loadNote(parsed);
    } catch {
      // handled by useWithdraw error state
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: NoteData = JSON.parse(ev.target?.result as string);
        loadNote(parsed);
        setNoteInput(JSON.stringify(parsed, null, 2));
      } catch {
        // invalid file
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateProof = async () => {
    if (!note || !recipient) return;
    setTreeError(null);

    try {
      // Use source chain from note (default to Flow for old notes)
      const sourceChainId = note.sourceChainId ?? 545;
      const chainConfig = getChainConfig(sourceChainId);
      const bridgeAddress = getBridgeAddress(sourceChainId);

      if (!bridgeAddress || !chainConfig) {
        setTreeError(`Bridge not deployed on chain ${sourceChainId}`);
        return;
      }

      // Create a client for the source chain (may differ from wallet chain)
      const rpcUrl = chainConfig.chain.rpcUrls.default.http[0];
      const sourceClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(rpcUrl),
      });

      const nextLeafIndex = await sourceClient.readContract({
        address: bridgeAddress,
        abi: PRIVACY_BRIDGE_ABI,
        functionName: 'nextLeafIndex',
      }) as bigint;

      if (nextLeafIndex === 0n) {
        setTreeError('No deposits found on-chain');
        return;
      }

      // Paginate getLogs in 10,000-block chunks (RPC limit)
      const currentBlock = await sourceClient.getBlockNumber();
      const EVENT_DEF = {
        type: 'event' as const,
        name: 'CommitmentLocked' as const,
        inputs: [
          { type: 'uint256' as const, name: 'commitment' as const, indexed: true },
          { type: 'uint256' as const, name: 'leafIndex' as const, indexed: false },
        ],
      };
      const CHUNK = 9999n;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allLogs: any[] = [];
      for (let from = 0n; from <= currentBlock; from += CHUNK + 1n) {
        const to = from + CHUNK > currentBlock ? currentBlock : from + CHUNK;
        const chunk = await sourceClient.getLogs({
          address: bridgeAddress,
          event: EVENT_DEF,
          fromBlock: from,
          toBlock: to,
        });
        allLogs.push(...chunk);
      }

      const commitments = allLogs
        .sort((a: { args: { leafIndex: bigint } }, b: { args: { leafIndex: bigint } }) => Number(a.args.leafIndex - b.args.leafIndex))
        .map((log: { args: { commitment: bigint } }) => log.args.commitment.toString());

      const userCommitment = note.commitment;
      const leafIndex = commitments.findIndex((c: string) => c === userCommitment);

      if (leafIndex === -1) {
        setTreeError('Your commitment was not found on-chain. Make sure the deposit is confirmed.');
        return;
      }

      const { root, pathElements, pathIndices } = buildMerkleTree(commitments, leafIndex);

      await generateProof(recipient, {
        pathElements,
        pathIndices,
        root,
      });
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : 'Failed to build merkle tree');
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
        <h2 className="text-base font-semibold mb-4 tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
          Withdraw from Privacy Bridge
        </h2>

        {/* Progress steps */}
        <div className="flex items-center gap-0 mb-6">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-0 flex-1">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className="w-6 h-6 flex items-center justify-center text-xs font-medium"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    background: i < currentStep
                      ? 'var(--text-heading)'
                      : i === currentStep
                        ? 'var(--surface-raised)'
                        : 'var(--bg)',
                    color: i < currentStep
                      ? 'var(--bg)'
                      : i === currentStep
                        ? 'var(--text-heading)'
                        : 'var(--text-label)',
                    border: i === currentStep
                      ? '1px solid var(--text-heading)'
                      : '1px solid var(--border-strong)',
                  }}
                >
                  {i < currentStep ? '\u2713' : i + 1}
                </div>
                <span className="text-[12px] hidden sm:block" style={{ color: i <= currentStep ? 'var(--text-body)' : 'var(--text-label)', fontFamily: 'var(--font-mono)' }}>
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mt-[-14px] sm:mt-[-14px]"
                  style={{ background: i < currentStep ? 'var(--text-heading)' : 'var(--border-strong)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Load note */}
        {!note && (
          <div className="space-y-3">
            <p className="text-[14px]" style={{ color: 'var(--text-label)' }}>
              Paste the JSON from your deposit note, or upload the backup file.
            </p>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder='{"secret":"...","nullifier":"...","commitment":"...","amount":"..."}'
              rows={6}
              className="w-full p-3 text-[15px] font-mono resize-none focus:outline-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-body)',
              }}
            />
            <div className="flex gap-px" style={{ background: 'var(--border)' }}>
              <button
                onClick={handlePasteNote}
                disabled={!noteInput.trim()}
                className="cta-btn flex-1 text-center text-[15px]"
                style={!noteInput.trim() ? {
                  background: 'var(--surface-raised)',
                  color: 'var(--text-label)',
                  cursor: 'not-allowed',
                } : {}}
              >
                Load Note
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 px-4 py-2.5 text-[15px]"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-raised)', color: 'var(--text-body)', border: 'none' }}
              >
                Upload File
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Step 2: Note loaded, enter recipient + generate proof */}
        {note && !proofData && (
          <div className="space-y-4">
            <div className="p-4 text-xs font-mono space-y-1" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-body)' }}>
              <div>
                <span style={{ color: 'var(--text-label)' }}>Amount: </span>
                {(Number(note.amount) / 1e18).toFixed(4)} FLOW
              </div>
              <div className="break-all">
                <span style={{ color: 'var(--text-label)' }}>Commitment: </span>
                {note.commitment}
              </div>
            </div>

            <div>
              <label className="block text-[15px] mb-1" style={{ color: 'var(--text-body)' }}>
                Starknet Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2.5 text-[15px] font-mono focus:outline-none"
                style={{
                  background: 'var(--bg)',
                  border: `1px solid ${recipient && !isValidRecipient ? 'rgba(239,68,68,0.5)' : 'var(--border-strong)'}`,
                  color: 'var(--text-body)',
                }}
              />
              {recipient && !isValidRecipient && (
                <p className="text-[13px] mt-1" style={{ color: '#f87171' }}>
                  Address must start with 0x and be at least 42 characters
                </p>
              )}
            </div>

            <button
              onClick={handleGenerateProof}
              disabled={!isValidRecipient || status === 'proving'}
              className="cta-btn w-full text-center"
              style={!isValidRecipient || status === 'proving' ? {
                background: 'var(--surface-raised)',
                color: 'var(--text-label)',
                cursor: 'not-allowed',
              } : {}}
            >
              {status === 'proving' ? 'Generating proof...' : 'Generate Proof'}
            </button>
          </div>
        )}

        {/* Step 3: Proof ready, get calldata */}
        {proofData && !calldata && (
          <div className="space-y-4">
            <div className="text-[15px]" style={{ color: '#34d399' }}>
              Groth16 proof generated
            </div>
            <button
              onClick={getCalldata}
              disabled={status === 'fetching_calldata'}
              className="cta-btn w-full text-center"
              style={status === 'fetching_calldata' ? {
                background: 'var(--surface-raised)',
                color: 'var(--text-label)',
                cursor: 'not-allowed',
              } : {}}
            >
              {status === 'fetching_calldata'
                ? 'Fetching calldata...'
                : 'Get Calldata'}
            </button>
          </div>
        )}

        {/* Step 4: Calldata ready, relay */}
        {calldata && status !== 'done' && (
          <div className="space-y-4">
            <div className="text-[15px]" style={{ color: '#34d399' }}>Calldata ready</div>
            <button
              onClick={submitRelay}
              disabled={status === 'relaying'}
              className="cta-btn w-full text-center"
              style={status === 'relaying' ? {
                background: 'var(--surface-raised)',
                color: 'var(--text-label)',
                cursor: 'not-allowed',
              } : {}}
            >
              {status === 'relaying'
                ? 'Submitting to relayer...'
                : 'Submit via Relayer'}
            </button>
          </div>
        )}

        {/* Done */}
        {status === 'done' && relayTxHash && (
          <div className="space-y-2">
            <div className="text-[15px]" style={{ color: '#34d399' }}>
              Withdrawal submitted successfully
            </div>
            <div className="text-xs font-mono break-all" style={{ color: 'var(--text-body)' }}>
              TX: {relayTxHash}
            </div>
          </div>
        )}

        {/* Error */}
        {(error || treeError) && (
          <div className="mt-4 p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-[15px]" style={{ color: '#f87171' }}>{error || treeError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
