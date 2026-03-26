'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    el.querySelectorAll('.reveal').forEach((r) => obs.observe(r));
    return () => obs.disconnect();
  }, []);
  return ref;
}

const DATA_ROWS = [
  ['CIRCUIT', '6,634 constraints'],
  ['TREE', 'depth-24 Poseidon'],
  ['CALLDATA', '1,977 felts'],
  ['TESTS', '93/93 PASS'],
  ['DENOMINATIONS', '4 pools'],
  ['ROOT BUFFER', '30 entries'],
];

const FLOW_STEPS = [
  { step: '01', verb: 'Lock', desc: 'Deposit a fixed denomination into the PrivacyBridge contract. A Poseidon commitment is inserted into the on-chain Merkle tree.', chain: 'Flow EVM' },
  { step: '02', verb: 'Prove', desc: 'Generate a Groth16 proof off-chain. The proof attests to knowledge of a valid commitment without revealing which one.', chain: 'Off-chain / Browser' },
  { step: '03', verb: 'Verify', desc: 'The garaga verifier on Starknet checks the Groth16 proof on-chain. Nullifier hash is checked against the spent set.', chain: 'Starknet' },
  { step: '04', verb: 'Claim', desc: 'pFLOW tokens are minted to the recipient. The nullifier is marked spent. No link to the original deposit is visible on-chain.', chain: 'Starknet' },
];

const SECURITY = [
  ['Fixed Denominations', '0.0001, 0.001, 0.01, 0.1 FLOW'],
  ['On-chain Merkle Tree', 'Poseidon incremental, depth 24, 30-root buffer'],
  ['Commitment Hiding', 'Poseidon(Poseidon(secret, nullifier), amount)'],
  ['Clean Events', 'Mint emits nullifier_hash + amount only'],
  ['Relayer Pattern', 'Fee-protected (max_fee_bps bound)'],
  ['Withdrawal Timelock', 'Configurable delay, root_timestamps'],
  ['Emergency Withdraw', '30-day timelock, owner-initiated'],
];

const DEPLOYMENTS = [
  ['PoseidonT3', '0xa49dF7B02806B4661d2D7064fE857af9BDc9a82a'],
  ['PoseidonT3Wrapper', '0x2eaEF8016D2a7Dc01677E57183a167649cB07402'],
  ['PrivacyBridge', '0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca'],
];

const LIMITATIONS = [
  ['Root relay', 'Centralized (owner relays Merkle root from Flow to Starknet)'],
  ['Emergency withdraw', 'Single-key with 30-day timelock (rug vector, mitigated not eliminated)'],
  ['Trusted setup', '1-party ceremony (Hermez Phase 1 ptau)'],
  ['known_roots', 'Unbounded on Starknet (intentional: pruning would lock user funds)'],
];

export default function Home() {
  const containerRef = useScrollReveal();

  return (
    <div className="grid-bg min-h-screen" ref={containerRef}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 backdrop-blur-xl" style={{ borderColor: 'var(--border-default)', background: 'rgba(17,17,24,0.85)' }}>
        <span className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: 'var(--font-heading)' }}>Privacy Bridge</span>
        <span className="text-xs font-medium tracking-wider uppercase flex items-center" style={{ color: 'var(--text-muted)' }}>
          <span className="pulse-dot mr-1.5" style={{ background: 'var(--amber)' }} />
          System Active
        </span>
        <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>v1.0 // Flow EVM &rarr; Starknet</span>
      </header>

      <main className="max-w-[1200px] mx-auto px-4">
        {/* Hero */}
        <section className="grid md:grid-cols-[55fr_45fr] gap-6 py-20 md:py-28">
          <div className="reveal flex flex-col justify-center md:pr-12">
            <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              <span className="hero-line">Deposit on one chain.</span>
              <span className="hero-line">Withdraw on another.</span>
              <span className="hero-line">No link between them.</span>
            </h1>
            <p className="text-base leading-relaxed max-w-[480px]" style={{ color: 'var(--text-secondary)' }}>
              Groth16 proofs break the on-chain trail between Flow EVM deposits and Starknet withdrawals. Fixed denomination pools, on-chain Poseidon Merkle tree, relayer pattern.
            </p>
            <div className="flex items-center gap-1.5 mt-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--green)' }}>
              <span className="pulse-dot" style={{ background: 'var(--green)', marginRight: 0 }} />
              93/93 tests passing
            </div>
            <div className="flex items-center gap-4 mt-6 flex-wrap">
              <Link href="/bridge" className="cta-btn">Launch App</Link>
              <a href="#flow" className="text-sm border-b pb-px transition-colors hover:text-white" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', borderColor: 'var(--border-default)', textDecoration: 'none' }}>
                How it works &darr;
              </a>
            </div>
          </div>
          <div className="reveal reveal-delay-1 p-6 flex flex-col justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)' }}>
            <div className="text-xs font-medium tracking-wider uppercase pb-2 mb-4" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)', borderBottom: '1px solid var(--grid-line)' }}>
              System Parameters
            </div>
            {DATA_ROWS.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between py-1.5 px-2 -mx-2 rounded-sm transition-colors hover:bg-[#18181f]" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="flex-1 mx-2 border-b border-dotted" style={{ borderColor: 'var(--border-default)', marginBottom: '3px' }} />
                <span className="font-medium tabular-nums" style={{ color: 'var(--cyan)' }}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Protocol Flow */}
        <section id="flow" className="py-16">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-6" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>Protocol Flow</div>
          <div className="reveal reveal-delay-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ border: '1px solid var(--grid-line)' }}>
            {FLOW_STEPS.map((s, i) => (
              <div key={s.step} className="flow-cell relative p-6 flex flex-col gap-2 transition-all hover:bg-[#18181f] hover:-translate-y-0.5" style={{ borderRight: i < 3 ? '1px solid var(--grid-line)' : 'none' }}>
                <div className="text-xs font-medium tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.step}</div>
                <div className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--amber)', letterSpacing: '-0.01em' }}>{s.verb}</div>
                <div className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{s.desc}</div>
                <div className="text-xs tracking-wider uppercase mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.chain}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Security Matrix */}
        <section className="py-16">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-6" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>Security Matrix</div>
          <div className="reveal reveal-delay-1 overflow-x-auto">
            <table className="w-full border-collapse" style={{ border: '1px solid var(--grid-line)' }}>
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium tracking-wider uppercase px-6 py-4" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--grid-line)' }}>Property</th>
                  <th className="text-left text-xs font-medium tracking-wider uppercase px-6 py-4" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--grid-line)' }}>Implementation</th>
                </tr>
              </thead>
              <tbody>
                {SECURITY.map(([prop, detail]) => (
                  <tr key={prop} className="transition-colors hover:bg-[#18181f]">
                    <td className="matrix-property relative font-medium pl-6 px-6 py-4 whitespace-nowrap" style={{ color: 'var(--text-primary)', border: '1px solid var(--grid-line)', paddingLeft: '22px' }}>{prop}</td>
                    <td className="px-6 py-4 break-words" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-muted)', border: '1px solid var(--grid-line)' }}>{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Deployment */}
        <section className="py-16">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-6" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>Deployment</div>
          <div className="reveal reveal-delay-1 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--grid-line)', borderRadius: 'var(--radius)' }}>
            <div className="flex items-center gap-1.5 px-6 py-2.5" style={{ borderBottom: '1px solid var(--grid-line)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#ff5f57', opacity: 0.7 }} />
              <span className="w-2 h-2 rounded-full" style={{ background: '#febc2e', opacity: 0.7 }} />
              <span className="w-2 h-2 rounded-full" style={{ background: '#28c840', opacity: 0.7 }} />
            </div>
            <div className="p-6 overflow-x-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.8 }}>
              <div>
                <span style={{ color: 'var(--amber)' }}>&gt;</span>{' '}
                <span style={{ color: 'var(--text-muted)' }}>flow-evm-testnet deployment</span>
                <span className="terminal-cursor" />
              </div>
              <div className="h-3" />
              {DEPLOYMENTS.map(([name, addr]) => (
                <div key={name}>
                  <span className="inline-block min-w-[180px]" style={{ color: 'var(--text-primary)' }}>{name}</span>{' '}
                  <span className="tabular-nums" style={{ color: 'var(--cyan)' }}>{addr}</span>
                </div>
              ))}
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--grid-line)', color: 'var(--text-muted)' }}>
                <div>chain_id: 545</div>
                <div>rpc: testnet.evm.nodes.onflow.org</div>
              </div>
            </div>
          </div>
        </section>

        {/* Known Limitations */}
        <section className="py-16">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-6" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>Known Limitations</div>
          <div className="reveal reveal-delay-1" style={{ border: '1px solid var(--grid-line)' }}>
            {LIMITATIONS.map(([label, desc], i) => (
              <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-6 px-6 py-4 text-sm leading-relaxed transition-colors hover:bg-[#18181f]" style={{ borderBottom: i < LIMITATIONS.length - 1 ? '1px solid var(--grid-line)' : 'none' }}>
                <span className="font-medium whitespace-nowrap shrink-0 sm:min-w-[170px]" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{label}</span>
                <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 mt-16" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--surface)' }}>
        <span className="text-xs font-medium tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>PL_Genesis Hackathon</span>
        <div className="flex items-center gap-6 mt-2 sm:mt-0">
          <a href="https://github.com/Yonkoo11/privacy-bridge" target="_blank" rel="noopener noreferrer" className="text-sm border-b pb-px transition-colors hover:text-white" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', borderColor: 'var(--grid-line)', textDecoration: 'none' }}>GitHub</a>
        </div>
      </footer>
    </div>
  );
}
