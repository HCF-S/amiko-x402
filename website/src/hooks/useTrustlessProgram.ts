'use client';

import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { getTrustlessProgram } from '@/lib/program';

/**
 * Hook to get the Trustless program instance
 */
export function useTrustlessProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );

    return getTrustlessProgram(connection, provider);
  }, [connection, wallet]);

  return { program, wallet, connection };
}
