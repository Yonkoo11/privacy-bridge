'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletConnect from '@/components/WalletConnect';

const NAV_ITEMS = [
  { href: '/bridge', label: 'Dashboard' },
  { href: '/bridge/deposit', label: 'Deposit' },
  { href: '/bridge/withdraw', label: 'Withdraw' },
  { href: '/bridge/notes', label: 'Notes' },
];

export default function BridgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-[13px] font-bold tracking-[0.18em] uppercase shrink-0"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)', textDecoration: 'none' }}
          >
            Privacy Bridge
          </Link>

          {/* Flow indicator */}
          <nav className="flow-indicator hidden sm:flex" aria-label="Bridge flow">
            <span className="flow-indicator-node active">EVM</span>
            <span className="flow-indicator-line active" aria-hidden="true" />
            <span className="flow-indicator-node active">ZK</span>
            <span className="flow-indicator-line" aria-hidden="true" />
            <span className="flow-indicator-node">Starknet</span>
          </nav>

          <WalletConnect />
        </div>
      </header>

      {/* Nav tabs */}
      <nav style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto px-4 nav-scroll flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 sm:px-4 py-2.5 text-[14px] font-medium -mb-px whitespace-nowrap shrink-0"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: isActive ? 'var(--text-heading)' : 'var(--text-label)',
                  borderBottom: isActive ? '2px solid var(--accent, #34d399)' : '2px solid transparent',
                  textDecoration: 'none',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase' as const,
                  fontSize: '11px',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
