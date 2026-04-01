'use client';

import Link from 'next/link';
import { useAccount, useReadContract } from 'wagmi';
import { getDenominations, getBridgeAddress, PRIVACY_BRIDGE_ABI } from '@/lib/constants';
import { SUPPORTED_CHAINS, getChainConfig } from '@/lib/chains';
import ChainSelector from './ChainSelector';

export default function Dashboard() {
  const { chain } = useAccount();
  const chainId = chain?.id ?? 545;
  const chainConfig = getChainConfig(chainId);
  const symbol = chain?.nativeCurrency?.symbol ?? 'FLOW';
  const denominations = getDenominations(chainId);
  const bridgeAddress = getBridgeAddress(chainId);

  const { data: depositCount } = useReadContract({
    address: bridgeAddress ?? undefined,
    abi: PRIVACY_BRIDGE_ABI,
    functionName: 'getDepositCount',
    query: { enabled: !!bridgeAddress },
  });

  const { data: latestRoot } = useReadContract({
    address: bridgeAddress ?? undefined,
    abi: PRIVACY_BRIDGE_ABI,
    functionName: 'getLatestRoot',
    query: { enabled: !!bridgeAddress },
  });

  const totalDeposits = depositCount ? Number(depositCount) : 0;
  const rootHex = latestRoot ? `0x${latestRoot.toString(16).padStart(64, '0')}` : null;
  const isEmpty = totalDeposits === 0;

  // Mock anonymity counts per denomination (would need event indexing for real data)
  const anonCounts = [0, 0, 0, 0];

  const renderAnonBar = (count: number) => {
    const segs = 10;
    const filled = Math.min(Math.round((count / 30) * segs), segs);
    return (
      <div className="anon-bar">
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} className={`anon-bar-seg ${i < filled ? (count >= 5 ? 'filled-green' : 'filled-amber') : ''}`} />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ChainSelector />

      <div className="stamp" style={{ transform: 'none', display: 'block' }}>
        Small anonymity sets provide weak privacy. Wait for more deposits before withdrawing.
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-px" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[10px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>Deposits</div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {bridgeAddress ? totalDeposits : '--'}
          </div>
        </div>
        <div className="px-4 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[10px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>Currency</div>
          <div className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{symbol}</div>
        </div>
        <div className="px-4 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[10px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>Relayer</div>
          <div className="text-[13px] flex items-center gap-2" style={{ color: 'var(--text-label)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-label)' }} />
            Offline
          </div>
        </div>
      </div>

      {isEmpty && (
        <div className="p-5 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
          <p className="text-[13px] mb-3" style={{ color: 'var(--text-label)' }}>
            {bridgeAddress ? 'No deposits yet. Start building your anonymity set.' : `Bridge not deployed on ${chain?.name ?? 'this network'}.`}
          </p>
          <Link href="/bridge/deposit" className="cta-btn text-[12px]" style={{ padding: '10px 28px' }}>Make First Deposit</Link>
        </div>
      )}

      {/* Anonymity sets with bar charts */}
      <div className="stamp" style={{ transform: 'rotate(-0.5deg)' }}>
        &mdash;&mdash; Anonymity Intelligence &mdash;&mdash; Unclassified &mdash;&mdash;
      </div>
      <div className="doc-panel">
        <div className="doc-panel-header" style={{ fontSize: '11px' }}>Anonymity Sets by Denomination</div>
        <div className="p-4 space-y-0">
          {denominations.map((d, i) => (
            <div key={i} className="flex items-center gap-3 py-3" style={{ borderBottom: i < denominations.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span className="text-[13px] font-mono shrink-0 w-28" style={{ color: 'var(--text-body)' }}>{d.label}</span>
              {renderAnonBar(anonCounts[i])}
              <span className="text-[12px] tabular-nums shrink-0 w-20 text-right" style={{ color: anonCounts[i] === 0 ? 'var(--text-label)' : anonCounts[i] < 5 ? 'var(--amber)' : 'var(--accent)' }}>
                {anonCounts[i]} deposits
              </span>
              <span className="text-[10px] uppercase tracking-wider shrink-0 w-16 text-right" style={{ color: anonCounts[i] >= 5 ? 'var(--accent)' : anonCounts[i] > 0 ? 'var(--amber)' : 'var(--text-label)' }}>
                {anonCounts[i] >= 5 ? 'Strong' : anonCounts[i] > 0 ? 'Small' : 'Empty'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Merkle root */}
      <div className="doc-panel">
        <div className="doc-panel-header" style={{ fontSize: '11px' }}>Latest Merkle Root</div>
        <div className="p-4">
          <p className="text-[12px] font-mono break-all" style={{ color: rootHex ? 'var(--text-stamp)' : 'var(--text-label)' }}>
            {rootHex ?? 'No roots relayed yet'}
          </p>
        </div>
      </div>
    </div>
  );
}
