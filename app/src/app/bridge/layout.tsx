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
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-100">
            Privacy Bridge
          </Link>
          <WalletConnect />
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
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
