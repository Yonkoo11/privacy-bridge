'use client';

import { useAccount, useSwitchChain, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { SUPPORTED_CHAINS, CHAIN_CONFIG } from '@/lib/chains';

export default function ChainSelector() {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();

  const handleSelect = (chainId: number) => {
    if (!isConnected) {
      connect({ connector: injected() });
      return;
    }
    if (chain?.id !== chainId) {
      switchChain({ chainId });
    }
  };

  return (
    <div className="chain-map" role="radiogroup" aria-label="Select source chain">
      {SUPPORTED_CHAINS.map((c, i) => {
        const config = CHAIN_CONFIG[c.id];
        const isSelected = chain?.id === c.id;
        const isLive = !!config?.bridgeAddress;
        const abbrev = c.name.replace(' Testnet', '').replace(' Sepolia', '').replace(' Amoy', '').replace('Ethereum', 'ETH').replace('Flow EVM', 'Flow').replace('Arbitrum', 'ARB').replace('Optimism', 'OP').replace('Polygon', 'POL').replace('Base', 'Base');

        return (
          <div key={c.id} className="flex items-center gap-0">
            <button
              className={`chain-node ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(c.id)}
              role="radio"
              aria-checked={isSelected}
              disabled={!isLive}
              style={!isLive ? { opacity: 0.4, cursor: 'default' } : {}}
            >
              <span className="chain-node-label">{abbrev}</span>
              <span className={`chain-dot ${isLive ? 'live' : ''}`} />
            </button>
            {i < SUPPORTED_CHAINS.length - 1 && <span className="chain-line" aria-hidden="true" />}
          </div>
        );
      })}
      <div className="chain-arrow" aria-hidden="true">
        <span className="chain-arrow-line" />
        <span className="chain-arrow-head" />
      </div>
      <div className="chain-node" style={{ cursor: 'default' }}>
        <span className="chain-node-label" style={{ color: 'var(--accent)' }}>Starknet</span>
        <span className="chain-dot destination" />
      </div>
    </div>
  );
}
