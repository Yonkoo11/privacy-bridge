'use client';

import './globals.css';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  flowEvmTestnet, sepolia, baseSepolia,
  arbitrumSepolia, polygonAmoy, optimismSepolia,
} from '@/lib/chains';

const config = createConfig({
  chains: [flowEvmTestnet, sepolia, baseSepolia, arbitrumSepolia, polygonAmoy, optimismSepolia],
  transports: {
    [flowEvmTestnet.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [polygonAmoy.id]: http(),
    [optimismSepolia.id]: http(),
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
        <meta name="description" content="Multichain ZK privacy bridge. Deposit on any EVM chain, withdraw on Starknet. Groth16 proofs sever the on-chain trail." />
        <meta property="og:title" content="Privacy Bridge" />
        <meta property="og:description" content="Deposit on any chain. Withdraw on another. No link between them. Groth16 ZK proofs, Poseidon Merkle tree, 6 source networks." />
        <meta property="og:image" content="https://yonkoo11.github.io/privacy-bridge/og.png" />
        <meta property="og:url" content="https://yonkoo11.github.io/privacy-bridge/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Privacy Bridge" />
        <meta name="twitter:description" content="Deposit on any chain. Withdraw on another. No link between them." />
        <meta name="twitter:image" content="https://yonkoo11.github.io/privacy-bridge/og.png" />
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
