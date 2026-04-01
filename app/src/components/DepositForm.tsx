'use client';

import { useState } from 'react';
import { useAccount, useConnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import Link from 'next/link';
import { useDeposit } from '@/hooks/useDeposit';
import { getDenominations, getDenomHints } from '@/lib/constants';
import { SUPPORTED_CHAIN_IDS, getChainConfig, getExplorerTxUrl } from '@/lib/chains';
import ChainSelector from './ChainSelector';

export default function DepositForm() {
  const { isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();

  const chainId = chain?.id ?? 0;
  const chainConfig = getChainConfig(chainId);
  const isSupported = SUPPORTED_CHAIN_IDS.has(chainId);
  const isDeployed = !!chainConfig?.bridgeAddress;
  const chainName = chain?.name ?? 'Unknown';

  const denominations = getDenominations(chainId);
  const denomHints = getDenomHints(chainId);

  const {
    generateNote, lockDeposit, noteData, status, error, txHash, isConfirmed,
  } = useDeposit();

  const [selectedDenom, setSelectedDenom] = useState(0);
  const [noteSaved, setNoteSaved] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  // Mock anonymity set counts (would come from on-chain in production)
  const anonCounts = [12, 4, 0, 0];

  const handleGenerate = () => {
    const amount = denominations[selectedDenom].value;
    generateNote(amount, chainId);
    setNoteSaved(false);
    setBackedUp(false);
  };

  const handleDownload = () => {
    if (!noteData) return;
    const blob = new Blob([JSON.stringify(noteData, null, 2)], { type: 'application/json' });
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
    lockDeposit(BigInt(noteData.commitment), BigInt(noteData.amount), chainId);
  };

  const renderAnonBar = (count: number) => {
    const segs = 10;
    const filled = Math.min(Math.round((count / 30) * segs), segs);
    return (
      <div className="denom-bar" style={{ width: 80 }}>
        {Array.from({ length: segs }).map((_, i) => (
          <span
            key={i}
            className={`denom-bar-seg ${i < filled ? (count >= 5 ? 'filled' : 'warn') : ''}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Chain transit map */}
      <ChainSelector />

      <div className="p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
        <div className="stamp" style={{ transform: 'none', display: 'block', marginBottom: 20 }}>
          &mdash;&mdash; Departure // Deposit &mdash;&mdash;
        </div>

        {/* Denomination selector - vertical list with anonymity bars */}
        <div className="mb-6">
          <label className="block text-[11px] uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--text-label)' }}>
            Select Amount
          </label>
          <div className="flex flex-col gap-px" style={{ background: 'var(--border)' }}>
            {denominations.map((d, i) => (
              <button
                key={i}
                onClick={() => setSelectedDenom(i)}
                className={`denom-row-transit ${selectedDenom === i ? 'selected' : ''}`}
              >
                <span className="denom-radio" />
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono)' }}>
                  {d.label}
                </span>
                <span className="text-[11px]" style={{ color: anonCounts[i] >= 5 ? 'var(--accent)' : anonCounts[i] > 0 ? 'var(--amber)' : 'var(--text-label)' }}>
                  ~{anonCounts[i]} in set
                </span>
                {renderAnonBar(anonCounts[i])}
              </button>
            ))}
          </div>
        </div>

        {/* Generate note */}
        {!noteData && (
          !isConnected ? (
            <button onClick={() => connect({ connector: injected() })} className="cta-btn w-full text-center">
              Connect Wallet to Deposit
            </button>
          ) : !isSupported ? (
            <div className="p-4 text-center text-[13px]" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              Unsupported network. Select a supported chain above.
            </div>
          ) : !isDeployed ? (
            <div className="p-4 text-center text-[13px]" style={{ color: 'var(--amber)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
              {chainName} bridge coming soon. Switch to Flow EVM to deposit now.
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={status === 'generating'}
              className="cta-btn w-full text-center"
              style={status === 'generating' ? { background: 'var(--surface-raised)', color: 'var(--text-label)', cursor: 'not-allowed' } : {}}
            >
              {status === 'generating' ? 'Generating...' : 'Generate Note'}
            </button>
          )
        )}

        {/* Note display + backup */}
        {noteData && status === 'ready' && (
          <div className="space-y-4">
            {/* Commitment box with green left border */}
            <div className="p-3" style={{ background: 'var(--surface-raised)', borderLeft: '2px solid var(--accent)' }}>
              <div className="space-y-1 text-[12px] font-mono" style={{ color: 'var(--text-body)' }}>
                <div className="flex gap-3">
                  <span style={{ color: 'var(--text-label)', minWidth: 90 }}>COMMITMENT</span>
                  <span className="break-all" style={{ color: 'var(--text-stamp)' }}>{noteData.commitment}</span>
                </div>
                <div className="flex gap-3">
                  <span style={{ color: 'var(--text-label)', minWidth: 90 }}>AMOUNT</span>
                  <span>{denominations[selectedDenom].label}</span>
                </div>
                <div className="flex gap-3">
                  <span style={{ color: 'var(--text-label)', minWidth: 90 }}>SOURCE</span>
                  <span>{chainName}</span>
                </div>
              </div>
            </div>

            {/* Backup buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold"
                style={{ fontFamily: 'var(--font-heading)', background: 'transparent', color: 'var(--text-body)', border: '1px solid var(--border-strong)' }}
              >
                Download
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold"
                style={{ fontFamily: 'var(--font-heading)', background: 'transparent', color: 'var(--text-body)', border: '1px solid var(--border-strong)' }}
              >
                Copy
              </button>
            </div>

            {/* Checkbox - I have backed up my note */}
            <label className="note-check">
              <input
                type="checkbox"
                className="note-check-box"
                checked={backedUp}
                onChange={(e) => setBackedUp(e.target.checked)}
              />
              I HAVE BACKED UP MY NOTE
            </label>

            {/* Lock deposit */}
            <button
              onClick={handleLock}
              disabled={!backedUp}
              className="cta-btn w-full text-center"
              style={!backedUp ? { background: 'var(--surface-raised)', color: 'var(--text-label)', cursor: 'not-allowed' } : {}}
            >
              {backedUp ? `Lock on ${chainName}` : 'Back up note first'}
            </button>
          </div>
        )}

        {/* Status */}
        {status === 'locking' && (
          <div className="mt-4 text-[13px] status-pulse" style={{ color: 'var(--text-body)' }}>Confirm in wallet</div>
        )}
        {status === 'confirming' && (
          <div className="mt-4 text-[13px] status-pulse" style={{ color: 'var(--text-body)' }}>Waiting for confirmation</div>
        )}
        {status === 'done' && isConfirmed && (
          <div className="mt-4 space-y-3">
            <div className="text-[13px]" style={{ color: 'var(--accent)' }}>Deposit confirmed on {chainName}</div>
            {txHash && (
              <a href={getExplorerTxUrl(chainId, txHash)} target="_blank" rel="noopener noreferrer"
                className="text-[12px]" style={{ color: 'var(--text-stamp)', borderBottom: '1px solid var(--border-strong)', display: 'inline' }}>
                View on Explorer
              </a>
            )}
            <div className="p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-[12px] mb-2" style={{ color: 'var(--text-label)' }}>For encrypted backup:</p>
              <Link href="/bridge/notes" className="text-[12px] font-medium" style={{ color: 'var(--text-stamp)', borderBottom: '1px solid var(--border-strong)' }}>
                Go to Note Manager
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-[13px]" style={{ color: '#f87171' }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
