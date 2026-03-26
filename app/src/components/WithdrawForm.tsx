'use client';

import { useState, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { useWithdraw } from '@/hooks/useWithdraw';
import { PRIVACY_BRIDGE_ADDRESS, PRIVACY_BRIDGE_ABI } from '@/lib/constants';
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
    if (!note || !recipient || !publicClient) return;
    setTreeError(null);

    try {
      // Fetch all commitments from Flow EVM contract
      const nextIndex = await publicClient.readContract({
        address: PRIVACY_BRIDGE_ADDRESS,
        abi: PRIVACY_BRIDGE_ABI,
        functionName: 'nextIndex',
      }) as bigint;

      if (nextIndex === 0n) {
        setTreeError('No deposits found on-chain');
        return;
      }

      // Read Deposit events to get ordered commitments
      const logs = await publicClient.getLogs({
        address: PRIVACY_BRIDGE_ADDRESS,
        event: {
          type: 'event',
          name: 'Deposit',
          inputs: [
            { type: 'uint256', name: 'commitment', indexed: true },
            { type: 'uint256', name: 'leafIndex', indexed: false },
            { type: 'uint256', name: 'timestamp', indexed: false },
          ],
        },
        fromBlock: 0n,
        toBlock: 'latest',
      });

      // Sort by leafIndex to get correct tree ordering
      const commitments = logs
        .sort((a, b) => Number(a.args.leafIndex! - b.args.leafIndex!))
        .map((log) => log.args.commitment!.toString());

      // Find user's commitment in the tree
      const userCommitment = note.commitment;
      const leafIndex = commitments.findIndex((c) => c === userCommitment);

      if (leafIndex === -1) {
        setTreeError('Your commitment was not found on-chain. Make sure the deposit is confirmed.');
        return;
      }

      // Build merkle tree and get proof
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Withdraw from Privacy Bridge
        </h2>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  i < currentStep
                    ? 'bg-emerald-600 text-white'
                    : i === currentStep
                      ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-400'
                      : 'bg-gray-800 text-gray-500'
                }`}
              >
                {i < currentStep ? '\u2713' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px ${
                    i < currentStep ? 'bg-emerald-600' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Load note */}
        {!note && (
          <div className="space-y-3">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Paste your note JSON here..."
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-300 placeholder:text-gray-600 resize-none focus:outline-none focus:border-gray-600"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePasteNote}
                disabled={!noteInput.trim()}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg"
              >
                Load Note
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700"
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
            <div className="bg-gray-800 rounded-lg p-4 text-xs font-mono text-gray-400 space-y-1">
              <div>
                <span className="text-gray-500">Amount: </span>
                {(Number(note.amount) / 1e18).toFixed(4)} FLOW
              </div>
              <div className="break-all">
                <span className="text-gray-500">Commitment: </span>
                {note.commitment}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Starknet Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>

            <button
              onClick={handleGenerateProof}
              disabled={!recipient || status === 'proving'}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg"
            >
              {status === 'proving' ? 'Generating proof...' : 'Generate Proof'}
            </button>
          </div>
        )}

        {/* Step 3: Proof ready, get calldata */}
        {proofData && !calldata && (
          <div className="space-y-4">
            <div className="text-sm text-emerald-400">
              Groth16 proof generated
            </div>
            <button
              onClick={getCalldata}
              disabled={status === 'fetching_calldata'}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg"
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
            <div className="text-sm text-emerald-400">Calldata ready</div>
            <button
              onClick={submitRelay}
              disabled={status === 'relaying'}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg"
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
            <div className="text-sm text-emerald-400">
              Withdrawal submitted successfully
            </div>
            <div className="text-xs text-gray-400 font-mono break-all">
              TX: {relayTxHash}
            </div>
          </div>
        )}

        {/* Error */}
        {(error || treeError) && (
          <div className="mt-4 bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error || treeError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
