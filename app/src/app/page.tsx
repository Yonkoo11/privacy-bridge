'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-gray-100">Privacy Bridge</h1>
          <p className="text-gray-400">
            ZK cross-chain bridge from Flow EVM to Starknet. Deposit on Flow,
            withdraw privately on Starknet with Groth16 zero-knowledge proofs.
          </p>
        </div>

        <Link
          href="/bridge"
          className="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg"
        >
          Launch App
        </Link>

        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-300">Deposit</div>
            <div className="text-xs text-gray-500 mt-1">Lock FLOW on EVM</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-300">Prove</div>
            <div className="text-xs text-gray-500 mt-1">
              Groth16 in browser
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-300">Withdraw</div>
            <div className="text-xs text-gray-500 mt-1">
              Mint on Starknet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
