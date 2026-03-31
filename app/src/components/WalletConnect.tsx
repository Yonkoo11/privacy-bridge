'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { SUPPORTED_CHAIN_IDS } from '@/lib/chains';

export default function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const isUnsupported = isConnected && !SUPPORTED_CHAIN_IDS.has(chain?.id ?? 0);

  if (isConnected && isUnsupported) {
    return (
      <span className="text-[15px] px-3 py-1.5" style={{
        fontFamily: 'var(--font-mono)',
        color: '#fbbf24',
        background: 'rgba(251,191,36,0.1)',
        border: '1px solid rgba(251,191,36,0.3)',
      }}>
        Unsupported Network
      </span>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-mono" style={{ color: 'var(--text-label)' }}>
          {chain?.name?.replace(' Testnet', '').replace(' Sepolia', '').replace(' Amoy', '') ?? ''}
        </span>
        <span className="text-[15px] font-mono tabular-nums" style={{ color: 'var(--text-body)' }}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-[15px]"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-body)',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="cta-btn text-[15px]"
      style={{ padding: '8px 20px' }}
    >
      Connect Wallet
    </button>
  );
}
