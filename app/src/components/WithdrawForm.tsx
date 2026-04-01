'use client';

import { useState, useRef } from 'react';
import { createPublicClient, http } from 'viem';
import { useWithdraw } from '@/hooks/useWithdraw';
import { getBridgeAddress, PRIVACY_BRIDGE_ABI } from '@/lib/constants';
import { getChainConfig } from '@/lib/chains';
import { buildMerkleTree } from '@/lib/merkle';
import type { NoteData } from '@/lib/encryption';

const STEP_LABELS = ['Note loaded', 'Proof generated', 'Calldata fetched', 'Delivered to Starknet'];

export default function WithdrawForm() {
  const {
    loadNote, generateProof, getCalldata, submitRelay,
    note, status, error, proofData, calldata, relayTxHash,
  } = useWithdraw();

  const [noteInput, setNoteInput] = useState('');
  const [recipient, setRecipient] = useState('');
  const isValidRecipient = recipient.startsWith('0x') && recipient.length >= 42;
  const [treeError, setTreeError] = useState<string | null>(null);
  const [stepTimes, setStepTimes] = useState<(number | null)[]>([null, null, null, null]);
  const [autoRunning, setAutoRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);


  // Determine current step from status
  const getStepIndex = () => {
    if (status === 'idle') return -1;
    if (status === 'loaded') return 0;
    if (status === 'proving') return 1;
    if (status === 'proved') return 1;
    if (status === 'fetching_calldata') return 2;
    if (status === 'calldata_ready') return 2;
    if (status === 'relaying') return 3;
    if (status === 'done') return 4;
    return -1;
  };
  const currentStep = getStepIndex();

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

  const handleDeclassify = async () => {
    if (!note || !recipient) return;
    setAutoRunning(true);
    setTreeError(null);
    startTimeRef.current = Date.now();
    const times: (number | null)[] = [null, null, null, null];

    try {
      // Step 1: already loaded
      times[0] = 0.1;
      setStepTimes([...times]);

      // Step 2: generate proof
      const sourceChainId = note.sourceChainId ?? 545;
      const chainConfig = getChainConfig(sourceChainId);
      const bridgeAddress = getBridgeAddress(sourceChainId);

      if (!bridgeAddress || !chainConfig) {
        setTreeError(`Bridge not deployed on chain ${sourceChainId}`);
        setAutoRunning(false);
        return;
      }

      const rpcUrl = chainConfig.chain.rpcUrls.default.http[0];
      const sourceClient = createPublicClient({ chain: chainConfig.chain, transport: http(rpcUrl) });

      const nextLeafIndex = await sourceClient.readContract({
        address: bridgeAddress, abi: PRIVACY_BRIDGE_ABI, functionName: 'nextLeafIndex',
      }) as bigint;

      if (nextLeafIndex === 0n) {
        setTreeError('No deposits found on-chain');
        setAutoRunning(false);
        return;
      }

      const currentBlock = await sourceClient.getBlockNumber();
      const EVENT_DEF = {
        type: 'event' as const, name: 'CommitmentLocked' as const,
        inputs: [
          { type: 'uint256' as const, name: 'commitment' as const, indexed: true },
          { type: 'uint256' as const, name: 'leafIndex' as const, indexed: false },
        ],
      };
      const CHUNK = 9999n;
      const startBlock = chainConfig.deployBlock ?? 0n;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allLogs: any[] = [];
      for (let from = startBlock; from <= currentBlock; from += CHUNK + 1n) {
        const to = from + CHUNK > currentBlock ? currentBlock : from + CHUNK;
        const chunk = await sourceClient.getLogs({
          address: bridgeAddress, event: EVENT_DEF, fromBlock: from, toBlock: to,
        });
        allLogs.push(...chunk);
      }

      const commitments = allLogs
        .sort((a: { args: { leafIndex: bigint } }, b: { args: { leafIndex: bigint } }) => Number(a.args.leafIndex - b.args.leafIndex))
        .map((log: { args: { commitment: bigint } }) => log.args.commitment.toString());

      const leafIndex = commitments.findIndex((c: string) => c === note.commitment);
      if (leafIndex === -1) {
        setTreeError('Commitment not found on-chain. Ensure deposit is confirmed.');
        setAutoRunning(false);
        return;
      }

      const { root, pathElements, pathIndices } = buildMerkleTree(commitments, leafIndex);

      const proofStart = Date.now();
      await generateProof(recipient, { pathElements, pathIndices, root });
      times[1] = Number(((Date.now() - proofStart) / 1000).toFixed(1));
      setStepTimes([...times]);

      // Step 3: get calldata
      const calldataStart = Date.now();
      await getCalldata();
      times[2] = Number(((Date.now() - calldataStart) / 1000).toFixed(1));
      setStepTimes([...times]);

      // Step 4: relay
      const relayStart = Date.now();
      await submitRelay();
      times[3] = Number(((Date.now() - relayStart) / 1000).toFixed(1));
      setStepTimes([...times]);

    } catch (err) {
      setTreeError(err instanceof Error ? err.message : 'Withdrawal failed');
    }
    setAutoRunning(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
        <div className="stamp" style={{ transform: 'none', display: 'block', marginBottom: 20 }}>
          &mdash;&mdash; Arrival // Withdraw &mdash;&mdash;
        </div>

        {/* Starknet disclosure */}
        {note && note.sourceChainId && note.sourceChainId !== 545 && (
          <div className="mb-4 p-3 text-[13px]" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', color: 'var(--amber)' }}>
            Starknet withdrawal for {getChainConfig(note.sourceChainId)?.chain.name ?? 'this chain'} is being deployed. Your deposit is safe.
          </div>
        )}

        {/* Step 1: Load note */}
        {!note && (
          <div className="space-y-3">
            <label className="block text-[11px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-label)' }}>
              Load Transit Document
            </label>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Paste note JSON or upload file..."
              rows={4}
              className="w-full p-3 text-[12px] font-mono resize-none focus:outline-none"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', color: 'var(--text-body)' }}
            />
            <div className="flex gap-2">
              <button
                onClick={handlePasteNote}
                disabled={!noteInput.trim()}
                className="cta-btn flex-1 text-center text-[12px]"
                style={!noteInput.trim() ? { background: 'var(--surface-raised)', color: 'var(--text-label)', cursor: 'not-allowed' } : {}}
              >
                Load Note
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold"
                style={{ fontFamily: 'var(--font-heading)', background: 'transparent', color: 'var(--text-body)', border: '1px solid var(--border-strong)' }}
              >
                Upload File
              </button>
              <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </div>
          </div>
        )}

        {/* Step 2: Note loaded, enter recipient + declassify */}
        {note && !autoRunning && status !== 'done' && (
          <div className="space-y-4">
            {/* Note info */}
            <div className="p-3" style={{ background: 'var(--surface-raised)', borderLeft: '2px solid var(--accent)' }}>
              <div className="space-y-1 text-[12px] font-mono">
                <div className="flex gap-3">
                  <span style={{ color: 'var(--text-label)', minWidth: 80 }}>AMOUNT</span>
                  <span style={{ color: 'var(--text-heading)' }}>{(Number(note.amount) / 1e18).toFixed(4)} {getChainConfig(note.sourceChainId ?? 545)?.chain.nativeCurrency.symbol ?? 'ETH'}</span>
                </div>
                <div className="flex gap-3">
                  <span style={{ color: 'var(--text-label)', minWidth: 80 }}>SOURCE</span>
                  <span>{getChainConfig(note.sourceChainId ?? 545)?.chain.name ?? 'Flow EVM'}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--text-label)' }}>
                Recipient (Starknet)
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2.5 text-[13px] font-mono focus:outline-none"
                style={{ background: 'var(--surface-raised)', border: `1px solid ${recipient && !isValidRecipient ? 'rgba(239,68,68,0.5)' : 'var(--border-strong)'}`, color: 'var(--text-heading)' }}
              />
            </div>

            <button
              onClick={handleDeclassify}
              disabled={!isValidRecipient}
              className="cta-btn w-full text-center"
              style={!isValidRecipient ? { background: 'var(--surface-raised)', color: 'var(--text-label)', cursor: 'not-allowed' } : {}}
            >
              Declassify
            </button>
          </div>
        )}

        {/* Progress tracker (dispatch style with elapsed times) */}
        {(autoRunning || status === 'done') && (
          <div className="space-y-1 mt-4">
            <div className="text-[11px] uppercase tracking-[0.1em] mb-3" style={{ color: 'var(--text-label)' }}>
              Transit Status
            </div>
            {STEP_LABELS.map((label, i) => {
              const isDone = currentStep > i || (currentStep === 4 && i === 3);
              const isActive = currentStep === i || (autoRunning && currentStep === i);
              const isPending = currentStep < i;

              return (
                <div key={i} className={`transit-status-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                  <span className="icon">
                    {isDone ? '\u2713' : isActive ? '\u25CF' : '\u25CB'}
                  </span>
                  <span>{label}</span>
                  <span className="elapsed">
                    {stepTimes[i] !== null ? `${stepTimes[i]}s` : isActive ? '...' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Done */}
        {status === 'done' && relayTxHash && (
          <div className="mt-4 space-y-2">
            <div className="text-[13px]" style={{ color: 'var(--accent)' }}>Withdrawal submitted</div>
            <div className="text-[12px] font-mono break-all" style={{ color: 'var(--text-body)' }}>TX: {relayTxHash}</div>
          </div>
        )}

        {/* Error */}
        {(error || treeError) && (
          <div className="mt-4 p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-[13px]" style={{ color: '#f87171' }}>{error || treeError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
