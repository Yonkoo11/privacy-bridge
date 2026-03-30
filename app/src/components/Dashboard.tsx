'use client';

import Link from 'next/link';
import { DENOMINATIONS } from '@/lib/constants';

export default function Dashboard() {
  const stats = {
    tvl: '0.0000',
    totalDeposits: 0,
    latestRoot: null as string | null,
    relayerStatus: 'offline' as 'online' | 'offline',
    relayerFee: '1%',
  };

  const isEmpty = stats.totalDeposits === 0;

  const denomSets = DENOMINATIONS.map((d) => ({
    label: d.label,
    size: 0,
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Warning banner */}
      <div className="stamp" style={{ transform: 'none', display: 'block' }}>
        Small anonymity sets provide weak privacy. Wait for more deposits in
        your denomination before withdrawing.
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Total Value Locked
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {stats.tvl} FLOW
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Total Deposits
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {stats.totalDeposits}
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Relayer Status
          </div>
          <div className="text-base flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: stats.relayerStatus === 'online' ? '#34d399' : 'var(--text-label)' }} />
            {stats.relayerStatus === 'online' ? 'Online' : 'Not connected'}
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Relayer Fee
          </div>
          <div className="text-base" style={{ color: 'var(--text-body)' }}>{stats.relayerFee}</div>
        </div>
      </div>

      {/* Empty state CTA */}
      {isEmpty && (
        <div className="p-5 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
          <p className="text-[15px] mb-3" style={{ color: 'var(--text-label)' }}>No deposits yet. Start building your anonymity set.</p>
          <Link href="/bridge/deposit" className="cta-btn text-[15px]" style={{ padding: '10px 28px' }}>
            Make First Deposit
          </Link>
        </div>
      )}

      {/* Anonymity sets */}
      <div className="doc-panel">
        <div className="doc-panel-header" style={{ fontSize: '13px', letterSpacing: '0.08em' }}>Anonymity Sets by Denomination</div>
        <div className="p-4 space-y-0">
          {denomSets.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: i < denomSets.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              <span className="text-[15px] font-mono" style={{ color: 'var(--text-body)' }}>
                {d.label}
              </span>
              <span
                className="text-[15px] font-medium tabular-nums"
                style={{ color: d.size === 0 ? 'var(--text-label)' : d.size < 5 ? '#fbbf24' : '#34d399' }}
              >
                {d.size} deposits
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest root */}
      <div className="doc-panel">
        <div className="doc-panel-header" style={{ fontSize: '13px', letterSpacing: '0.08em' }}>Latest Merkle Root</div>
        <div className="p-4">
          <p className="text-sm font-mono break-all" style={{ color: 'var(--text-label)' }}>
            {stats.latestRoot ?? 'No roots relayed yet'}
          </p>
        </div>
      </div>
    </div>
  );
}
