'use client';

import { DENOMINATIONS } from '@/lib/constants';

export default function Dashboard() {
  // Placeholder data -- in production, these come from on-chain queries
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
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
        <p className="text-amber-400 text-sm">
          Small anonymity sets provide weak privacy. Wait for more deposits in
          your denomination before withdrawing.
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Total Value Locked
          </div>
          <div className="text-2xl font-semibold text-gray-100 tabular-nums">
            {stats.tvl} FLOW
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Total Deposits
          </div>
          <div className="text-2xl font-semibold text-gray-100 tabular-nums">
            {stats.totalDeposits}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Relayer Status
          </div>
          <div className="text-lg text-gray-400">{stats.relayerStatus}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Relayer Fee
          </div>
          <div className="text-lg text-gray-400">{stats.relayerFee}</div>
        </div>
      </div>

      {/* Anonymity sets */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-300 mb-4">
          Anonymity Sets by Denomination
        </h3>
        <div className="space-y-3">
          {denomSets.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
            >
              <span className="text-sm text-gray-400 font-mono">
                {d.label}
              </span>
              <span
                className={`text-sm font-medium tabular-nums ${
                  d.size === 0
                    ? 'text-gray-600'
                    : d.size < 5
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }`}
              >
                {d.size} deposits
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest root */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Latest Merkle Root
        </h3>
        <p className="text-xs font-mono text-gray-500 break-all">
          {stats.latestRoot}
        </p>
      </div>
    </div>
  );
}
