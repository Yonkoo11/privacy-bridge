'use client';

import Link from 'next/link';

const SPECS = [
  ['Circuit', '6,634 constraints'],
  ['Tree', 'Poseidon depth-24'],
  ['Calldata', '1,977 felts'],
  ['Tests', '93/93'],
  ['Pools', '4 denominations'],
  ['Root Buffer', '30 entries'],
];

const FLOW_STEPS = [
  { n: '1', verb: 'Lock', desc: 'Deposit a fixed denomination into the PrivacyBridge contract. A Poseidon commitment is inserted into the on-chain Merkle tree.', chain: 'Flow EVM' },
  { n: '2', verb: 'Prove', desc: 'Generate a Groth16 proof off-chain. The proof attests to knowledge of a valid commitment in the tree without revealing which one.', chain: 'Off-chain / Browser' },
  { n: '3', verb: 'Verify', desc: 'The garaga verifier on Starknet checks the Groth16 proof on-chain. Nullifier hash is checked against the spent set.', chain: 'Starknet' },
  { n: '4', verb: 'Claim', desc: 'Tokens are minted to the recipient on Starknet. The nullifier is marked spent. No link to the original deposit is visible.', chain: 'Starknet' },
];

const SECURITY = [
  ['Fixed Denominations', '0.0001, 0.001, 0.01, 0.1 FLOW'],
  ['On-chain Merkle Tree', 'Poseidon incremental, depth 24, 30-root buffer'],
  ['Commitment Hiding', 'Poseidon(Poseidon(secret, nullifier), amount)'],
  ['Clean Events', 'Mint emits nullifier_hash + amount only'],
  ['Relayer Pattern', 'Fee-protected via max_fee_bps bound'],
  ['Withdrawal Timelock', 'Configurable delay, root_timestamps'],
  ['Emergency Withdraw', '30-day timelock, owner-initiated'],
];

const CONTRACTS = [
  ['PoseidonT3', '0xa49dF7B02806B4661d2D7064fE857af9BDc9a82a'],
  ['PoseidonT3Wrapper', '0x2eaEF8016D2a7Dc01677E57183a167649cB07402'],
  ['PrivacyBridge', '0xd1959eA3d6ca0631f2e617ac7CE71e297E5328Ca'],
];

const LIMITATIONS = [
  'Root relay is centralized. The watcher service uses a single owner key to post Merkle roots cross-chain. A malicious operator can delay roots but cannot steal funds.',
  'Garaga calldata proxy is a centralized service. It can cause transaction failures but cannot forge proofs or redirect withdrawals.',
  'Emergency withdraw is a single-key rug vector, mitigated by a 30-day timelock. Users have 30 days to exit if the owner initiates emergency mode.',
  '1-party trusted setup. The proving key was generated without a multi-party ceremony. A compromised setup allows forged proofs.',
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="max-w-[800px] mx-auto px-6">

        {/* Header */}
        <header className="flex items-baseline justify-between py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[13px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>Privacy Bridge</span>
          <span className="text-xs tracking-wider" style={{ color: 'var(--text-label)' }}>Flow EVM &rarr; Starknet</span>
        </header>

        {/* Hero */}
        <section className="pt-12 pb-8 sm:pt-16">
          <div className="text-[28px] sm:text-[38px] font-bold leading-[1.15]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)', letterSpacing: '-0.01em' }}>
            <div className="mb-1">Deposit on one chain.</div>
            <div className="mb-1">Withdraw on another.</div>
            <div className="redact-bar mb-1">No link between them.</div>
          </div>
          <p className="mt-6 text-sm leading-[1.7] max-w-[640px]" style={{ color: 'var(--text-body)' }}>
            Groth16 proofs sever the on-chain trail between Flow&nbsp;EVM deposits and Starknet withdrawals. Fixed denomination pools, Poseidon Merkle tree, relayer pattern.
          </p>
          <div className="mt-8">
            <Link href="/bridge" className="cta-btn">Launch App</Link>
          </div>
        </section>

        {/* Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px mb-16 mt-12" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
          {SPECS.map(([label, value]) => (
            <div key={label} className="px-6 py-4" style={{ background: 'var(--surface)' }}>
              <div className="text-[11px] font-medium tracking-[0.12em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>{label}</div>
              <div className="text-[15px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Protocol Flow */}
        <section className="mb-16">
          <div className="stamp">&mdash;&mdash; Protocol Flow &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="flow-track">
            {FLOW_STEPS.map((s) => (
              <div key={s.n} className="relative mb-8 last:mb-0">
                <div className="absolute -left-8 -top-0.5 w-6 text-center text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{s.n}</div>
                <div className="text-base font-semibold mb-1 tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{s.verb}</div>
                <div className="text-[14px] leading-[1.65] mb-2 max-w-[600px]" style={{ color: 'var(--text-body)' }}>{s.desc}</div>
                <div className="text-[11px] tracking-[0.08em] uppercase" style={{ color: 'var(--text-label)' }}>{s.chain}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="mb-16">
          <div className="stamp">&mdash;&mdash; Security Properties &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div>
            {SECURITY.map(([prop, detail]) => (
              <div key={prop} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-0 mb-px">
                <span className="text-[13px] font-medium px-4 py-3" style={{ color: 'var(--text-heading)', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>{prop}</span>
                <span className="text-[14px] px-4 py-3" style={{ color: 'var(--text-body)' }}>{detail}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contracts */}
        <section className="mb-16">
          <div className="stamp">&mdash;&mdash; Document Ref &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="doc-panel">
            <div className="doc-panel-header">Deployed Contracts // Flow EVM Testnet</div>
            <div className="p-4">
              {CONTRACTS.map(([name, addr]) => (
                <div key={name} className="flex items-baseline justify-between gap-4 py-2 flex-wrap">
                  <span className="text-[13px] font-medium shrink-0" style={{ color: 'var(--text-heading)' }}>{name}</span>
                  <span className="text-[13px] tabular-nums break-all" style={{ color: 'var(--text-stamp)' }}>{addr}</span>
                </div>
              ))}
              <div className="text-xs pt-3 mt-3" style={{ borderTop: '1px solid var(--border-strong)', color: 'var(--text-label)' }}>chain_id: 545</div>
            </div>
          </div>
        </section>

        {/* Limitations */}
        <section className="mb-16">
          <div className="stamp">&mdash;&mdash; Known Limitations &mdash;&mdash; Declassified &mdash;&mdash;</div>
          <ol className="list-none" style={{ counterReset: 'lim' }}>
            {LIMITATIONS.map((text, i) => (
              <li key={i} className="relative pl-6 py-3 text-[14px] leading-[1.6]" style={{ borderBottom: i < LIMITATIONS.length - 1 ? '1px solid var(--surface-raised)' : 'none', counterIncrement: 'lim' }}>
                <span className="absolute left-0 text-xs font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-label)' }}>{String(i + 1).padStart(2, '0')}</span>
                {text}
              </li>
            ))}
          </ol>
        </section>

        {/* Bottom CTA */}
        <div className="mt-16 mb-12">
          <Link href="/bridge" className="cta-btn">Launch App</Link>
        </div>

        {/* Footer */}
        <footer className="py-6 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-label)' }}>
          <span>PL_Genesis Hackathon</span>
          <span> &middot; </span>
          <a href="https://github.com/Yonkoo11/privacy-bridge" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-body)] transition-colors" style={{ color: 'var(--text-label)', textDecoration: 'none', borderBottom: '1px solid var(--border-strong)' }}>GitHub</a>
        </footer>

      </div>
    </div>
  );
}
