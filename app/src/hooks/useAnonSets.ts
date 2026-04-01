'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { getChainConfig } from '@/lib/chains';
import { getBridgeAddress, PRIVACY_BRIDGE_ABI } from '@/lib/constants';

/**
 * Reads on-chain deposit count for a given chain.
 * Per-denomination breakdown would require event indexing (the CommitmentLocked
 * event doesn't emit the deposit amount). For now, returns total deposits.
 */
export function useAnonSets(chainId: number) {
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const chainConfig = getChainConfig(chainId);
    const bridgeAddress = getBridgeAddress(chainId);
    if (!chainConfig || !bridgeAddress) {
      setTotalDeposits(0);
      setLoading(false);
      return;
    }

    const client = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    });

    client
      .readContract({
        address: bridgeAddress,
        abi: PRIVACY_BRIDGE_ABI,
        functionName: 'getDepositCount',
      })
      .then((count) => {
        setTotalDeposits(Number(count));
        setLoading(false);
      })
      .catch(() => {
        setTotalDeposits(0);
        setLoading(false);
      });
  }, [chainId]);

  return { totalDeposits, loading };
}
