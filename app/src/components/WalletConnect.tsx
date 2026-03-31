'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { flowEvmTestnet } from '@/lib/chains';

export default function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isWrongChain = isConnected && chain?.id !== flowEvmTestnet.id;

  if (isConnected && isWrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: flowEvmTestnet.id })}
        className="px-3 py-1.5 text-[15px]"
        style={{
          fontFamily: 'var(--font-mono)',
          color: '#fbbf24',
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
        }}
      >
        Switch to Flow EVM
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
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
