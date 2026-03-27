'use client';

import { DENOMINATIONS } from '@/lib/constants';

export default function Dashboard() {
  const stats = {
    tvl: '0.0000',
    totalDeposits: 0,
    latestRoot: 'N/A',
    relayerStatus: 'Unknown',
    relayerFee: '1%',
  };

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
          <div className="text-[11px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Total Value Locked
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {stats.tvl} FLOW
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[11px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Total Deposits
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {stats.totalDeposits}
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[11px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Relayer Status
          </div>
          <div className="text-base" style={{ color: 'var(--text-body)' }}>{stats.relayerStatus}</div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[11px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Relayer Fee
          </div>
          <div className="text-base" style={{ color: 'var(--text-body)' }}>{stats.relayerFee}</div>
        </div>
      </div>

      {/* Anonymity sets */}
      <div className="doc-panel">
        <div className="doc-panel-header">Anonymity Sets by Denomination</div>
        <div className="p-4 space-y-0">
          {denomSets.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: i < denomSets.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              <span className="text-[13px] font-mono" style={{ color: 'var(--text-body)' }}>
                {d.label}
              </span>
              <span
                className="text-[13px] font-medium tabular-nums"
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
        <div className="doc-panel-header">Latest Merkle Root</div>
        <div className="p-4">
          <p className="text-xs font-mono break-all" style={{ color: 'var(--text-label)' }}>
            {stats.latestRoot}
          </p>
        </div>
      </div>
    </div>
  );
}
