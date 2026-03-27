'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useDeposit } from '@/hooks/useDeposit';
import { DENOMINATIONS } from '@/lib/constants';

export default function DepositForm() {
  const { isConnected } = useAccount();
  const {
    generateNote,
    lockDeposit,
    noteData,
    status,
    error,
    txHash,
    isConfirmed,
  } = useDeposit();

  const [selectedDenom, setSelectedDenom] = useState(0);
  const [noteSaved, setNoteSaved] = useState(false);

  const handleGenerate = () => {
    const amount = DENOMINATIONS[selectedDenom].value;
    generateNote(amount);
    setNoteSaved(false);
  };

  const handleDownload = () => {
    if (!noteData) return;
    const blob = new Blob([JSON.stringify(noteData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy-bridge-note-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNoteSaved(true);
  };

  const handleCopy = async () => {
    if (!noteData) return;
    await navigator.clipboard.writeText(JSON.stringify(noteData, null, 2));
    setNoteSaved(true);
  };

  const handleLock = () => {
    if (!noteData) return;
    lockDeposit(BigInt(noteData.commitment), BigInt(noteData.amount));
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Deposit to Privacy Bridge
        </h2>

        {/* Step 1: Select denomination */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            Select Amount
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DENOMINATIONS.map((d, i) => (
              <button
                key={i}
                onClick={() => setSelectedDenom(i)}
                className={`px-4 py-3 rounded-lg text-sm font-medium border ${
                  selectedDenom === i
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Generate note */}
        {!noteData && (
          <button
            onClick={handleGenerate}
            disabled={!isConnected || status === 'generating'}
            className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium rounded-lg"
          >
            {!isConnected ? 'Connect wallet first' : 'Generate Note'}
          </button>
        )}

        {/* Step 3: Show note + backup */}
        {noteData && status === 'ready' && (
          <div className="space-y-4">
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
              <p className="text-amber-400 text-sm font-medium mb-1">
                Save this note before depositing
              </p>
              <p className="text-amber-400/70 text-xs">
                Without this note, your funds are unrecoverable.
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="space-y-2 text-xs font-mono text-gray-400 break-all">
                <div>
                  <span className="text-gray-400">commitment: </span>
                  {noteData.commitment}
                </div>
                <div>
                  <span className="text-gray-400">amount: </span>
                  {DENOMINATIONS[selectedDenom].label}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700"
              >
                Download Backup
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700"
              >
                Copy to Clipboard
              </button>
            </div>

            <button
              onClick={handleLock}
              disabled={!noteSaved}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium rounded-lg"
            >
              {noteSaved
                ? 'Lock on Flow EVM'
                : 'Save note first to enable deposit'}
            </button>
          </div>
        )}

        {/* Status display */}
        {status === 'locking' && (
          <div className="mt-4 text-sm text-gray-400">
            Confirm transaction in your wallet...
          </div>
        )}

        {status === 'confirming' && (
          <div className="mt-4 text-sm text-gray-400">
            Waiting for confirmation...
          </div>
        )}

        {status === 'done' && isConfirmed && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-emerald-400">
              Deposit confirmed on Flow EVM
            </div>
            {txHash && (
              <a
                href={`https://evm-testnet.flowscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-500 hover:text-emerald-400 underline"
              >
                View on FlowScan
              </a>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
