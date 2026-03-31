'use client';

import { useState } from 'react';
import { useAccount, useConnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useDeposit } from '@/hooks/useDeposit';
import { DENOMINATIONS } from '@/lib/constants';
import { flowEvmTestnet } from '@/lib/chains';

const DENOM_HINTS: Record<string, string> = {
  '0.0001 FLOW': 'Micro - test transactions',
  '0.001 FLOW': 'Small - low-value transfers',
  '0.01 FLOW': 'Medium - standard privacy',
  '0.1 FLOW': 'Large - high-value privacy',
};

export default function DepositForm() {
  const { isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isConnected && chain?.id !== flowEvmTestnet.id;
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
      <div className="p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
        <h2 className="text-base font-semibold mb-4 tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
          Deposit to Privacy Bridge
        </h2>

        {/* Step 1: Select denomination */}
        <div className="mb-6">
          <label className="block text-[15px] mb-2" style={{ color: 'var(--text-body)' }}>
            Select Amount
          </label>
          <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border)' }}>
            {DENOMINATIONS.map((d, i) => (
              <button
                key={i}
                onClick={() => setSelectedDenom(i)}
                className="px-4 py-3 text-left"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: selectedDenom === i ? 'var(--surface-raised)' : 'var(--surface)',
                  color: selectedDenom === i ? 'var(--text-heading)' : 'var(--text-body)',
                  border: selectedDenom === i ? '1px solid var(--text-heading)' : '1px solid transparent',
                }}
              >
                <div className="text-[15px] font-medium">{d.label}</div>
                <div className="text-[13px] mt-0.5" style={{ color: 'var(--text-label)' }}>{DENOM_HINTS[d.label] ?? ''}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Generate note */}
        {!noteData && (
          !isConnected ? (
            <button
              onClick={() => connect({ connector: injected() })}
              className="cta-btn w-full text-center"
            >
              Connect Wallet to Deposit
            </button>
          ) : isWrongChain ? (
            <button
              onClick={() => switchChain({ chainId: flowEvmTestnet.id })}
              className="cta-btn w-full text-center"
              style={{
                background: 'rgba(251,191,36,0.1)',
                color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.3)',
              }}
            >
              Switch to Flow EVM Testnet
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={status === 'generating'}
              className="cta-btn w-full text-center"
              style={status === 'generating' ? {
                background: 'var(--surface-raised)',
                color: 'var(--text-label)',
                cursor: 'not-allowed',
              } : {}}
            >
              Generate Note
            </button>
          )
        )}

        {/* Step 3: Show note + backup */}
        {noteData && status === 'ready' && (
          <div className="space-y-4">
            <div className="stamp" style={{ transform: 'none', display: 'block' }}>
              Save this note before depositing. Without it, your funds are unrecoverable.
            </div>

            <div className="p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="space-y-2 text-xs font-mono break-all" style={{ color: 'var(--text-body)' }}>
                <div>
                  <span style={{ color: 'var(--text-label)' }}>commitment: </span>
                  {noteData.commitment}
                </div>
                <div>
                  <span style={{ color: 'var(--text-label)' }}>amount: </span>
                  {DENOMINATIONS[selectedDenom].label}
                </div>
              </div>
            </div>

            <div className="flex gap-px" style={{ background: 'var(--border)' }}>
              <button
                onClick={handleDownload}
                className="flex-1 px-4 py-2.5 text-[15px]"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text-body)', border: 'none' }}
              >
                Download Backup
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 px-4 py-2.5 text-[15px]"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text-body)', border: 'none' }}
              >
                Copy to Clipboard
              </button>
            </div>

            <button
              onClick={handleLock}
              disabled={!noteSaved}
              className="cta-btn w-full text-center"
              style={!noteSaved ? {
                background: 'var(--surface-raised)',
                color: 'var(--text-label)',
                cursor: 'not-allowed',
              } : {}}
            >
              {noteSaved
                ? 'Lock on Flow EVM'
                : 'Save note first to enable deposit'}
            </button>
          </div>
        )}

        {/* Status display */}
        {status === 'locking' && (
          <div className="mt-4 text-[15px] status-pulse" style={{ color: 'var(--text-body)' }}>
            Confirm transaction in your wallet
          </div>
        )}

        {status === 'confirming' && (
          <div className="mt-4 text-[15px] status-pulse" style={{ color: 'var(--text-body)' }}>
            Waiting for confirmation
          </div>
        )}

        {status === 'done' && isConfirmed && (
          <div className="mt-4 space-y-2">
            <div className="text-[15px]" style={{ color: '#34d399' }}>
              Deposit confirmed on Flow EVM
            </div>
            {txHash && (
              <a
                href={`https://evm-testnet.flowscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm"
                style={{ color: 'var(--text-stamp)', borderBottom: '1px solid var(--border-strong)' }}
              >
                View on FlowScan
              </a>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-[15px]" style={{ color: '#f87171' }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
