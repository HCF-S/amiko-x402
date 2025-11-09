/**
 * Crossmint Transaction Signer for x402 Facilitator
 *
 * Provides functions to:
 * 1. Query the amiko-platform API to check if a wallet is Crossmint-managed
 * 2. Sign Solana transactions using the Crossmint API
 */

const CROSSMINT_API_BASE_URL = 'https://api.crossmint.com';
const AMIKO_PLATFORM_API_URL = process.env.AMIKO_PLATFORM_API_URL || 'http://localhost:4114';
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY;

if (!CROSSMINT_API_KEY) {
  console.warn('[crossmint-signer] CROSSMINT_API_KEY not set - Crossmint signing will fail');
}

export interface WalletLookupResponse {
  found: boolean;
  isCrossmint: boolean;
  custodian: string | null;
  owner: string | null;
  walletAddress: string;
  chainType: string | null;
  chain: string | null;
}

/**
 * Query the amiko-platform API to check if a wallet is managed by Crossmint
 */
export async function isWalletCrossmint(walletAddress: string): Promise<boolean> {
  try {
    console.log(`[crossmint-signer] Querying wallet: ${walletAddress}`);

    const response = await fetch(`${AMIKO_PLATFORM_API_URL}/api/wallets/${encodeURIComponent(walletAddress)}`);

    if (!response.ok) {
      console.error(`[crossmint-signer] API query failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const data: WalletLookupResponse = await response.json();

    console.log(`[crossmint-signer] Wallet lookup result:`, {
      found: data.found,
      isCrossmint: data.isCrossmint,
      custodian: data.custodian,
    });

    return data.isCrossmint;
  } catch (error: any) {
    console.error(`[crossmint-signer] Error querying wallet: ${error.message}`);
    return false;
  }
}

/**
 * Sign a Solana transaction using the Crossmint API
 *
 * @param walletAddress - The Crossmint wallet address
 * @param unsignedTransaction - Base58-encoded unsigned transaction
 * @returns Base64-encoded signed transaction
 */
export async function signTransactionWithCrossmint(
  walletAddress: string,
  unsignedTransaction: string
): Promise<string> {
  if (!CROSSMINT_API_KEY) {
    throw new Error('CROSSMINT_API_KEY is not set');
  }

  console.log(`[crossmint-signer] Signing transaction for wallet: ${walletAddress}`);
  console.log(`[crossmint-signer] Unsigned transaction (${unsignedTransaction.length} chars)`);

  const url = `${CROSSMINT_API_BASE_URL}/2025-06-09/wallets/${encodeURIComponent(walletAddress)}/transactions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CROSSMINT_API_KEY,
      },
      body: JSON.stringify({
        params: {
          transaction: unsignedTransaction,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Crossmint API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result.signedTransaction) {
      throw new Error('Crossmint API did not return signedTransaction');
    }

    console.log(`[crossmint-signer] Successfully signed transaction (${result.signedTransaction.length} chars)`);

    return result.signedTransaction;
  } catch (error: any) {
    console.error(`[crossmint-signer] Failed to sign transaction: ${error.message}`);
    throw error;
  }
}
