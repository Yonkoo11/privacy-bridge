'use client';

import Link from 'next/link';

const SPECS = [
  ['Circuit', '6,634 constraints'],
  ['Tree', 'Poseidon depth-24'],
  ['Calldata', '1,977 felts'],
  ['Tests', '93/93'],
  ['Chains', '6 networks'],
  ['Root Buffer', '30 entries'],
];

const SUPPORTED_CHAINS = [
  { name: 'Flow EVM', symbol: 'FLOW', status: 'live' },
  { name: 'Ethereum', symbol: 'ETH', status: 'live' },
  { name: 'Base', symbol: 'ETH', status: 'live' },
  { name: 'Arbitrum', symbol: 'ETH', status: 'live' },
  { name: 'Polygon', symbol: 'POL', status: 'soon' },
  { name: 'Optimism', symbol: 'ETH', status: 'live' },
];

const FLOW_STEPS = [
  { n: '1', verb: 'Lock', desc: 'Deposit a fixed denomination into the PrivacyBridge contract on any supported EVM chain. A Poseidon commitment is inserted into the on-chain Merkle tree.', chain: 'Any EVM Source' },
  { n: '2', verb: 'Prove', desc: 'Generate a Groth16 proof off-chain. The proof attests to knowledge of a valid commitment in the tree without revealing which one.', chain: 'Off-chain / Browser' },
  { n: '3', verb: 'Verify', desc: 'The garaga verifier on Starknet checks the Groth16 proof on-chain. Nullifier hash is checked against the spent set.', chain: 'Starknet' },
  { n: '4', verb: 'Claim', desc: 'Shielded tokens are minted to the recipient on Starknet. The nullifier is marked spent. No link to the original deposit is visible.', chain: 'Starknet' },
];

const SECURITY = [
  ['Fixed Denominations', '0.0001, 0.001, 0.01, 0.1 native token per chain'],
  ['On-chain Merkle Tree', 'Poseidon incremental, depth 24, 30-root buffer'],
  ['Commitment Hiding', 'Poseidon(Poseidon(secret, nullifier), amount)'],
  ['Minimal Events', 'Mint emits nullifier_hash only, no amount or recipient'],
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
  '1-party trusted setup. The proving key was generated without a multi-party ceremony. A compromised ceremony allows forged proofs. Production requires an MPC ceremony with 100+ participants.',
  'One-directional bridge. Shielded tokens on Starknet have no redemption path back to the source chain. This is a proof of concept, not a full bridge.',
  'Root relay is centralized. The watcher uses a single owner key to relay Merkle roots. A malicious operator could post a fake root containing fabricated commitments.',
  'Emergency withdraw is a single-key rug vector, mitigated by a 30-day timelock. Users have 30 days to exit if the owner initiates emergency mode.',
  'Amount is a public circuit input. While denomination pools provide uniform deposit sizes, the amount is visible on both chains. A production version should remove amount from public signals.',
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="max-w-[800px] mx-auto px-6">

        {/* Header */}
        <header className="flex items-baseline justify-between py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[13px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>Privacy Bridge</span>
          <span className="text-xs tracking-wider" style={{ color: 'var(--text-label)' }}>Multichain &rarr; Starknet</span>
        </header>

        {/* Hero */}
        <section className="pt-12 pb-8 sm:pt-16">
          <div className="text-[28px] sm:text-[38px] font-bold leading-[1.25] sm:leading-[1.15]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)', letterSpacing: '-0.01em' }}>
            <div className="mb-1">Deposit on any chain.</div>
            <div className="mb-1">Withdraw on Starknet.</div>
            <div className="redact-bar mb-1">No link between them.</div>
          </div>
          <p className="mt-6 text-base leading-[1.7] max-w-[640px]" style={{ color: 'var(--text-body)' }}>
            Groth16 proofs sever the on-chain trail between EVM deposits and Starknet withdrawals. Six source networks, fixed denomination pools, Poseidon Merkle tree, relayer pattern.
          </p>
          <div className="mt-8">
            <Link href="/bridge" className="cta-btn">Launch App</Link>
          </div>
        </section>

        {/* Supported Chains */}
        <section className="mb-16 mt-12">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-px" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
            {SUPPORTED_CHAINS.map((c) => (
              <div key={c.name} className="px-3 py-4 text-center" style={{ background: 'var(--surface)' }}>
                <div className="text-[14px] font-medium" style={{ fontFamily: 'var(--font-heading)', color: c.status === 'live' ? 'var(--text-heading)' : 'var(--text-label)' }}>
                  {c.name}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-label)' }}>{c.symbol}</div>
                <div className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: c.status === 'live' ? '#34d399' : 'var(--text-label)' }}>
                  {c.status === 'live' ? 'Live' : 'Soon'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px mb-16" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
          {SPECS.map(([label, value]) => (
            <div key={label} className="px-4 sm:px-6 py-4" style={{ background: 'var(--surface)' }}>
              <div className="text-[12px] sm:text-[13px] font-medium tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-label)' }}>{label}</div>
              <div className="text-[16px] sm:text-[17px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Protocol Flow */}
        <section className="mb-16 pl-4" style={{ borderLeft: '2px solid var(--border-strong)' }}>
          <div className="stamp">&mdash;&mdash; Protocol Flow &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="flow-track">
            {FLOW_STEPS.map((s) => (
              <div key={s.n} className="relative mb-8 last:mb-0">
                <div className="absolute -left-8 -top-0.5 w-6 text-center text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{s.n}</div>
                <div className="text-lg font-semibold mb-1 tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>{s.verb}</div>
                <div className="text-[15px] leading-[1.7] mb-2 max-w-[600px]" style={{ color: 'var(--text-body)' }}>{s.desc}</div>
                <div className="text-[13px] tracking-[0.08em] uppercase" style={{ color: 'var(--text-label)' }}>{s.chain}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="mb-16 pl-4" style={{ borderLeft: '2px solid var(--border-strong)' }}>
          <div className="stamp">&mdash;&mdash; Security Properties &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div>
            {SECURITY.map(([prop, detail]) => (
              <div key={prop} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-0 mb-px">
                <span className="text-[15px] font-medium px-4 py-3" style={{ color: 'var(--text-heading)', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>{prop}</span>
                <span className="text-[15px] px-4 py-3" style={{ color: 'var(--text-body)' }}>{detail}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contracts */}
        <section className="mb-16 pl-4" style={{ borderLeft: '2px solid var(--border-strong)' }}>
          <div className="stamp">&mdash;&mdash; Document Ref &mdash;&mdash; Unclassified &mdash;&mdash;</div>
          <div className="doc-panel">
            <div className="doc-panel-header">Deployed Contracts // Flow EVM Testnet</div>
            <div className="p-4">
              {CONTRACTS.map(([name, addr]) => (
                <div key={name} className="flex items-baseline justify-between gap-4 py-2 flex-wrap">
                  <span className="text-[15px] font-medium shrink-0" style={{ color: 'var(--text-heading)' }}>{name}</span>
                  <span className="text-[14px] tabular-nums break-all" style={{ color: 'var(--text-stamp)' }}>{addr}</span>
                </div>
              ))}
              <div className="text-sm pt-3 mt-3" style={{ borderTop: '1px solid var(--border-strong)', color: 'var(--text-label)' }}>
                chain_id: 545 &mdash; Additional chain deployments in progress
              </div>
            </div>
          </div>
        </section>

        {/* Limitations */}
        <section className="mb-16 pl-4" style={{ borderLeft: '2px solid var(--border-strong)' }}>
          <div className="stamp">&mdash;&mdash; Known Limitations &mdash;&mdash; Declassified &mdash;&mdash;</div>
          <ol className="list-none" style={{ counterReset: 'lim' }}>
            {LIMITATIONS.map((text, i) => (
              <li key={i} className="relative pl-8 py-3 text-[15px] leading-[1.7]" style={{ borderBottom: i < LIMITATIONS.length - 1 ? '1px solid var(--surface-raised)' : 'none', counterIncrement: 'lim' }}>
                <span className="absolute left-0 text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-label)' }}>{String(i + 1).padStart(2, '0')}</span>
                {text}
              </li>
            ))}
          </ol>
        </section>

        {/* Bottom CTA */}
        <div className="mt-16 mb-12 pt-12" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[15px] mb-4" style={{ color: 'var(--text-label)' }}>Ready to bridge privately?</p>
          <Link href="/bridge" className="cta-btn">Launch App</Link>
        </div>

        {/* Footer */}
        <footer className="py-6 text-sm flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-label)' }}>
          <span>Privacy Bridge</span>
          <a
            href="https://github.com/Yonkoo11/privacy-bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-body)',
              textDecoration: 'none',
              borderBottom: '1px solid var(--border-strong)',
              paddingBottom: '1px',
            }}
          >
            GitHub
          </a>
        </footer>

      </div>
    </div>
  );
}
