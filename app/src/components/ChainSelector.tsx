'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { SUPPORTED_CHAINS, CHAIN_CONFIG } from '@/lib/chains';

export default function ChainSelector() {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-px mb-6" style={{ background: 'var(--border)' }}>
      {SUPPORTED_CHAINS.map((c) => {
        const config = CHAIN_CONFIG[c.id];
        const isActive = chain?.id === c.id;
        const isDeployed = !!config?.bridgeAddress;

        return (
          <button
            key={c.id}
            onClick={() => isConnected && switchChain({ chainId: c.id })}
            disabled={!isConnected}
            className="px-2 py-3 text-center relative"
            style={{
              background: isActive ? 'var(--surface-raised)' : 'var(--surface)',
              border: isActive ? '1px solid var(--text-heading)' : '1px solid transparent',
              cursor: isConnected ? 'pointer' : 'default',
            }}
          >
            <div className="text-[13px] font-medium" style={{
              fontFamily: 'var(--font-heading)',
              color: isActive ? 'var(--text-heading)' : isDeployed ? 'var(--text-body)' : 'var(--text-label)',
            }}>
              {c.name.replace(' Testnet', '').replace(' Sepolia', '').replace(' Amoy', '')}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-label)' }}>
              {c.nativeCurrency.symbol}
            </div>
            {!isDeployed && (
              <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>
                Soon
              </div>
            )}
            {isActive && (
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#34d399' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
