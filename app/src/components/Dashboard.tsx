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

  const denomSets = denominations.map((d) => ({
    label: d.label,
    size: 0, // Per-denom counts would require event indexing
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ChainSelector />

      <div className="stamp" style={{ transform: 'none', display: 'block' }}>
        Small anonymity sets provide weak privacy. Wait for more deposits in
        your denomination before withdrawing.
      </div>

      <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Total Deposits
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {bridgeAddress ? totalDeposits : '--'}
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Native Currency
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {symbol}
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Relayer Status
          </div>
          <div className="text-base flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-label)' }} />
            Not connected
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[13px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>
            Supported Chains
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            {SUPPORTED_CHAINS.length}
          </div>
        </div>
      </div>

      {isEmpty && (
        <div className="p-5 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
          <p className="text-[15px] mb-3" style={{ color: 'var(--text-label)' }}>
            {bridgeAddress
              ? 'No deposits yet. Start building your anonymity set.'
              : `Bridge not yet deployed on ${chain?.name ?? 'this network'}.`}
          </p>
          <Link href="/bridge/deposit" className="cta-btn text-[15px]" style={{ padding: '10px 28px' }}>
            Make First Deposit
          </Link>
        </div>
      )}

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

      <div className="doc-panel">
        <div className="doc-panel-header" style={{ fontSize: '13px', letterSpacing: '0.08em' }}>Latest Merkle Root</div>
        <div className="p-4">
          <p className="text-sm font-mono break-all" style={{ color: 'var(--text-label)' }}>
            {rootHex ?? 'No roots relayed yet'}
          </p>
        </div>
      </div>
    </div>
  );
}
