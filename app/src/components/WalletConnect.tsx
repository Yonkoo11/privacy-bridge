'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-mono tabular-nums" style={{ color: 'var(--text-body)' }}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-[13px]"
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
      className="cta-btn text-[13px]"
      style={{ padding: '8px 20px' }}
    >
      Connect Wallet
    </button>
  );
}
