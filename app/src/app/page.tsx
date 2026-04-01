'use client';

import Link from 'next/link';

const SUPPORTED_CHAINS = [
  { name: 'Flow', symbol: 'FLOW', live: true },
  { name: 'ETH', symbol: 'ETH', live: true },
  { name: 'Base', symbol: 'ETH', live: true },
  { name: 'ARB', symbol: 'ETH', live: true },
  { name: 'OP', symbol: 'ETH', live: true },
  { name: 'POL', symbol: 'POL', live: false },
];

const DEPLOYED_CHAINS = [
  { chain: 'Flow EVM Testnet', chainId: 545, bridge: '0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca', live: true },
  { chain: 'Ethereum Sepolia', chainId: 11155111, bridge: '0x2eaEF8016D2a7Dc01677E57183a167649cB07402', live: true },
  { chain: 'Base Sepolia', chainId: 84532, bridge: '0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca', live: true },
  { chain: 'Arbitrum Sepolia', chainId: 421614, bridge: '0x2eaEF8016D2a7Dc01677E57183a167649cB07402', live: true },
  { chain: 'Optimism Sepolia', chainId: 11155420, bridge: '0x2eaEF8016D2a7Dc01677E57183a167649cB07402', live: true },
  { chain: 'Polygon Amoy', chainId: 80002, bridge: null, live: false },
];

const SECURITY_VERIFIED = [
  'Fixed denominations prevent amount correlation',
  'Commitment hiding via nested Poseidon hash',
  'Double-spend protection via nullifier tracking',
  'Fee protection via max_fee_bps bound',
  'Emergency withdraw with 30-day timelock',
  'Same circuit, separate bridge per source chain',
];

const SECURITY_DISCLOSED = [
  'Root relay centralized (single owner key)',
  'Garaga calldata proxy centralized',
  'Single-party trusted setup (no MPC ceremony)',
  'Non-Flow Starknet pairs pending deployment',
];

const LIMITATIONS = [
  '1-party trusted setup. The proving key was generated without a multi-party ceremony. A compromised ceremony allows forged proofs.',
  'One-directional bridge. Shielded tokens on Starknet have no redemption path back to the source chain.',
  'Root relay is centralized. The watcher uses a single owner key to relay Merkle roots cross-chain.',
  'Emergency withdraw is a single-key rug vector, mitigated by a 30-day timelock.',
  'Amount is a public circuit input. Denomination pools mitigate but do not eliminate amount correlation.',
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[960px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="text-[13px] font-bold tracking-[0.18em] uppercase shrink-0" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
            Privacy Bridge
          </span>
          <nav className="flow-indicator" aria-label="Bridge flow">
            <span className="flow-indicator-node active">EVM</span>
            <span className="flow-indicator-line active" aria-hidden="true" />
            <span className="flow-indicator-node active">ZK</span>
            <span className="flow-indicator-line" aria-hidden="true" />
            <span className="flow-indicator-node">Starknet</span>
          </nav>
          <Link href="/bridge" className="cta-btn" style={{ padding: '8px 20px', fontSize: '12px' }}>
            Launch App
          </Link>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-6">

        {/* Hero */}
        <section className="py-12 sm:py-16" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-0 mb-5">
            <span className="text-[24px] sm:text-[28px] font-bold shrink-0" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
              Deposit on any chain
            </span>
            <span className="hidden sm:block flex-1 mx-5 h-0" style={{ borderTop: '2px dashed var(--accent)' }} aria-hidden="true" />
            <span className="text-[24px] sm:text-[28px] font-bold shrink-0" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
              Withdraw on Starknet
            </span>
          </div>
          <div className="redact-bar text-[14px] font-bold tracking-[0.12em] uppercase mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
            No link between them
          </div>
          <p className="text-[14px] max-w-[640px]" style={{ color: 'var(--text-body)', lineHeight: 1.7 }}>
            Groth16 proofs sever the on-chain trail. 6 source chains. Fixed denomination pools. Poseidon Merkle tree.
          </p>
        </section>

        {/* Chain Transit Map */}
        <section className="py-8">
          <div className="stamp">&mdash;&mdash; Chain Transit Map &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="chain-map">
            {SUPPORTED_CHAINS.map((c, i) => (
              <div key={c.name} className="flex items-center gap-0">
                <div className={`chain-node ${i === 0 ? 'selected' : ''}`}>
                  <span className="chain-node-label">{c.name}</span>
                  <span className={`chain-dot ${c.live ? 'live' : ''}`} />
                </div>
                {i < SUPPORTED_CHAINS.length - 1 && <span className="chain-line" aria-hidden="true" />}
              </div>
            ))}
            <div className="chain-arrow" aria-hidden="true">
              <span className="chain-arrow-line" />
              <span className="chain-arrow-head" />
            </div>
            <div className="chain-node">
              <span className="chain-node-label" style={{ color: 'var(--accent)' }}>Starknet</span>
              <span className="chain-dot destination" />
            </div>
          </div>
        </section>

        {/* Protocol Sequence (horizontal) */}
        <section className="py-8" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="stamp">&mdash;&mdash; Protocol Sequence &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="protocol-flow">
            {[
              { n: '1', name: 'Lock', chain: 'EVM Chain', desc: 'Deposit fixed denomination, commitment added to Merkle tree' },
              { n: '2', name: 'Prove', chain: 'Browser', desc: 'Generate Groth16 proof of valid commitment' },
              { n: '3', name: 'Verify', chain: 'Starknet', desc: 'Garaga verifier checks proof on-chain' },
              { n: '4', name: 'Claim', chain: 'Starknet', desc: 'Tokens minted, nullifier marked spent' },
            ].map((step, i) => (
              <div key={step.n} className="contents">
                <div className="protocol-step">
                  <div className="protocol-step-num">{step.n}</div>
                  <div className="protocol-step-name">{step.name}</div>
                  <div className="protocol-step-chain">{step.chain}</div>
                  <div className="protocol-step-desc">{step.desc}</div>
                </div>
                {i < 3 && (
                  <div className="protocol-arrow">
                    <span className="protocol-arrow-line" />
                    <span className="protocol-arrow-head" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Deployed Contracts */}
        <section className="py-8" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="stamp">&mdash;&mdash; Transit Network &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="doc-panel">
            <div className="doc-panel-header">Deployed Contracts // 6 EVM Chains</div>
            <div className="p-4">
              {DEPLOYED_CHAINS.map((c) => (
                <div key={c.chainId} className="flex items-baseline justify-between gap-4 py-2.5 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.live ? 'var(--accent)' : 'var(--amber)' }} />
                    <span className="text-[14px] font-medium" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{c.chain}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-label)' }}>#{c.chainId}</span>
                  </div>
                  <span className="text-[12px] tabular-nums break-all font-mono" style={{ color: c.bridge ? 'var(--text-stamp)' : 'var(--text-label)' }}>
                    {c.bridge ?? 'PENDING'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Dossier */}
        <section className="py-8" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="stamp">&mdash;&mdash; Security Dossier &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="security-grid">
            <div>
              <div className="security-col-title">Verified</div>
              {SECURITY_VERIFIED.map((item) => (
                <div key={item} className="security-item">
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>&#10003;</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="security-col-title">Disclosed</div>
              {SECURITY_DISCLOSED.map((item) => (
                <div key={item} className="security-item">
                  <span style={{ color: 'var(--amber)', flexShrink: 0 }}>&#9888;</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Known Limitations */}
        <section className="py-8" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="stamp">&mdash;&mdash; Known Limitations &mdash;&mdash; Declassified &mdash;&mdash;</div>
          <ol className="list-none space-y-0">
            {LIMITATIONS.map((text, i) => (
              <li key={i} className="flex gap-3 py-3 text-[13px] leading-[1.7]" style={{ borderBottom: i < LIMITATIONS.length - 1 ? '1px solid var(--surface-raised)' : 'none' }}>
                <span className="text-[12px] font-semibold shrink-0 w-6" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-label)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Specs Bar */}
        <div className="specs-bar">
          CIRCUIT: 6,634 &nbsp;|&nbsp; TREE: DEPTH-24 &nbsp;|&nbsp; CALLDATA: 1,977 &nbsp;|&nbsp; TESTS: 93/93 &nbsp;|&nbsp; CHAINS: 6 &nbsp;|&nbsp; BUFFER: 30
        </div>

        {/* Bottom CTA */}
        <div className="py-12 text-center">
          <p className="text-[14px] mb-4" style={{ color: 'var(--text-label)' }}>Ready to bridge privately?</p>
          <Link href="/bridge" className="cta-btn">Launch App</Link>
        </div>

        {/* Footer */}
        <footer className="py-6 text-center text-[11px] uppercase tracking-[0.1em]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-label)' }}>
          Privacy Bridge &nbsp;&middot;&nbsp; PL_Genesis Hackathon &nbsp;&middot;&nbsp;{' '}
          <a href="https://github.com/Yonkoo11/privacy-bridge" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-label)', textDecoration: 'none' }}>
            GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}
