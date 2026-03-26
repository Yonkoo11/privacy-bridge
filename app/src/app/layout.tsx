'use client';

import './globals.css';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { flowEvmTestnet } from '@/lib/chains';

const config = createConfig({
  chains: [flowEvmTestnet],
  transports: {
    [flowEvmTestnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Privacy Bridge</title>
        <meta name="description" content="ZK cross-chain bridge from Flow EVM to Starknet" />
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/favicon.svg`} type="image/svg+xml" />
      </head>
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
