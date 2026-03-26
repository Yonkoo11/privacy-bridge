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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    el.querySelectorAll('.reveal').forEach((r) => obs.observe(r));
    return () => obs.disconnect();
  }, []);
  return ref;
}

const SPECS = [
  ['Circuit', '6,634 constraints'],
  ['Tree', 'Poseidon depth-24'],
  ['Calldata', '1,977 felts'],
  ['Tests', '93 / 93'],
  ['Pools', '4 denominations'],
  ['Root buffer', '30 entries'],
];

const FLOW_STEPS = [
  { step: '01', verb: 'Lock', desc: 'Deposit a fixed denomination into the PrivacyBridge contract. A Poseidon commitment enters the on-chain Merkle tree.', chain: 'Flow EVM' },
  { step: '02', verb: 'Prove', desc: 'Generate a Groth16 proof off-chain. The proof attests knowledge of a valid commitment without revealing which one.', chain: 'Browser' },
  { step: '03', verb: 'Verify', desc: 'The garaga verifier on Starknet checks the Groth16 proof on-chain. Nullifier hash is checked against the spent set.', chain: 'Starknet' },
  { step: '04', verb: 'Claim', desc: 'pFLOW tokens are minted to the recipient. The nullifier is marked spent. No link to the original deposit exists on-chain.', chain: 'Starknet' },
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

const CONTRACTS = [
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
    <div className="min-h-screen" ref={containerRef}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 backdrop-blur-xl" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,15,0.88)' }}>
        <span className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: 'var(--font-heading)' }}>Privacy Bridge</span>
        <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Flow EVM &rarr; Starknet</span>
      </header>

      <main className="max-w-[1080px] mx-auto px-6">
        {/* Hero */}
        <section className="py-24 md:py-32">
          <div className="reveal max-w-[640px]">
            <h1 className="text-3xl md:text-[44px] font-bold leading-[1.15] mb-6" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.025em' }}>
              <span className="hero-line">Deposit on one chain.</span>
              <span className="hero-line">Withdraw on another.</span>
              <span className="hero-line" style={{ color: 'var(--accent)' }}>No link between them.</span>
            </h1>
            <p className="text-base leading-relaxed mb-8 max-w-[520px]" style={{ color: 'var(--text-secondary)' }}>
              Groth16 proofs sever the on-chain trail between Flow&nbsp;EVM deposits and Starknet withdrawals. Fixed denomination pools, Poseidon Merkle tree, relayer pattern.
            </p>
            <div className="flex items-center gap-5">
              <Link href="/bridge" className="cta-btn">Launch App</Link>
              <a href="#how" className="text-sm transition-colors hover:text-white" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textDecoration: 'none' }}>
                How it works &darr;
              </a>
            </div>
          </div>
        </section>

        {/* Specs strip */}
        <section className="reveal py-8 border-t border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-4">
            {SPECS.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Protocol Flow */}
        <section id="how" className="py-20">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-8" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Protocol Flow</div>
          <div className="reveal reveal-delay-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'var(--border)' }}>
            {FLOW_STEPS.map((s) => (
              <div key={s.step} className="flow-cell relative p-6 flex flex-col gap-2 transition-colors hover:bg-[var(--surface-hover)]" style={{ background: 'var(--surface)' }}>
                <div className="text-[11px] tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.step}</div>
                <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent)' }}>{s.verb}</div>
                <div className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{s.desc}</div>
                <div className="text-[11px] tracking-wider uppercase mt-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.chain}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="py-20">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-8" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Security</div>
          <div className="reveal reveal-delay-1">
            {SECURITY.map(([prop, detail], i) => (
              <div key={prop} className="matrix-property relative flex flex-col sm:flex-row gap-1 sm:gap-8 pl-4 py-4 transition-colors hover:bg-[var(--surface-hover)]" style={{ borderBottom: i < SECURITY.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="font-medium whitespace-nowrap shrink-0 sm:min-w-[190px] text-sm">{prop}</span>
                <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{detail}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Deployment */}
        <section className="py-20">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-8" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Deployed Contracts</div>
          <div className="reveal reveal-delay-1 p-6 overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 2 }}>
              {CONTRACTS.map(([name, addr]) => (
                <div key={name}>
                  <span className="inline-block min-w-[180px]" style={{ color: 'var(--text-secondary)' }}>{name}</span>{' '}
                  <span className="tabular-nums" style={{ color: 'var(--accent)' }}>{addr}</span>
                </div>
              ))}
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <div>chain_id: 545 &middot; rpc: testnet.evm.nodes.onflow.org</div>
              </div>
            </div>
          </div>
        </section>

        {/* Limitations */}
        <section className="py-20">
          <div className="reveal text-xs font-medium tracking-wider uppercase mb-8" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Known Limitations</div>
          <div className="reveal reveal-delay-1">
            {LIMITATIONS.map(([label, desc], i) => (
              <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-8 py-4 text-sm leading-relaxed" style={{ borderBottom: i < LIMITATIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="font-medium whitespace-nowrap shrink-0 sm:min-w-[170px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between px-6 py-5 mt-8" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-xs tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>PL_Genesis Hackathon</span>
        <a href="https://github.com/Yonkoo11/privacy-bridge" target="_blank" rel="noopener noreferrer" className="text-xs transition-colors hover:text-white mt-2 sm:mt-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textDecoration: 'none' }}>GitHub &nearr;</a>
      </footer>
    </div>
  );
}
