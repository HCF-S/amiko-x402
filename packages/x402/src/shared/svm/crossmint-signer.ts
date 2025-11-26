/**
 * Crossmint Transaction Signer for x402 Protocol
 *
 * Provides functions to:
 * 1. Query the amiko-platform API to check if a wallet is Crossmint-managed
 * 2. Sign Solana transactions using the Crossmint API
 *
 * Based on the working implementation from amiko-platform/amiko-agent
 */

import { base58 } from "@scure/base";
import { getTransactionDecoder, type Transaction } from "@solana/kit";

const CROSSMINT_API_BASE_URL = 'https://staging.crossmint.com/api';

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
export async function isWalletCrossmint(
  walletAddress: string,
  platformApiUrl: string
): Promise<boolean> {
  try {
    console.log(`[crossmint-signer] Querying wallet: ${walletAddress}`);

    const response = await fetch(`${platformApiUrl}/public/wallets/${encodeURIComponent(walletAddress)}`);

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
 * @param unsignedTransaction - Unsigned Solana Transaction object (from @solana/kit)
 * @param crossmintApiKey - The Crossmint API key
 * @returns Signed transaction bytes
 */
export async function signTransactionWithCrossmint(
  walletAddress: string,
  unsignedTransaction: Transaction,
  crossmintApiKey: string
): Promise<Transaction> {
  if (!crossmintApiKey) {
    throw new Error('CROSSMINT_API_KEY is required for signing Crossmint wallets');
  }

  console.log(`[crossmint-signer] Signing transaction for wallet: ${walletAddress}`);

  // The transaction has messageBytes which is the compiled message (no signatures)
  const messageBytes = unsignedTransaction.messageBytes;

  // Solana VersionedTransaction message format:
  // Byte 0: Version prefix (0x80 for v0, or 0xFF for legacy)
  // Byte 1: Message header start - numRequiredSignatures
  const numRequiredSignatures = messageBytes[1];

  console.log(`[crossmint-signer] Transaction requires ${numRequiredSignatures} signatures`);

  // Create VersionedTransaction with empty signature placeholders
  // VersionedTransaction format:
  // 1 byte: number of signatures (compact-u16 encoding)
  // 64 bytes per signature (empty placeholders)
  // N bytes: the transaction message

  const signatureBytes = numRequiredSignatures * 64;
  const versionedTxBytes = new Uint8Array(1 + signatureBytes + messageBytes.length);

  // Write signature count
  versionedTxBytes[0] = numRequiredSignatures;

  // Empty signatures are already zeros from new Uint8Array()
  // Bytes 1 through (1 + signatureBytes - 1) are the signature placeholders

  // Write the transaction message after the signatures
  versionedTxBytes.set(messageBytes, 1 + signatureBytes);

  console.log(`[crossmint-signer] Created VersionedTransaction with ${numRequiredSignatures} signature placeholders`);
  console.log(`[crossmint-signer] VersionedTransaction length: ${versionedTxBytes.length}`);

  // Convert to base58 for Crossmint API
  const txBase58 = base58.encode(versionedTxBytes);

  // Create transaction via Crossmint API
  const url = `${CROSSMINT_API_BASE_URL}/2025-06-09/wallets/${encodeURIComponent(walletAddress)}/transactions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': crossmintApiKey,
    },
    body: JSON.stringify({
      params: {
        transaction: txBase58,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Crossmint transaction creation failed: ${response.status} ${errorText}`);
  }

  const transactionResponse = await response.json();
  const transactionId = transactionResponse.id;

  console.log(`[crossmint-signer] Transaction created: ${transactionId}`);
  console.log(`[crossmint-signer] Initial status: ${transactionResponse.status}`);

  // Poll for transaction to be signed
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    const statusUrl = `${CROSSMINT_API_BASE_URL}/2025-06-09/wallets/${encodeURIComponent(walletAddress)}/transactions/${transactionId}`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': crossmintApiKey,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to get transaction status: ${statusResponse.status} ${errorText}`);
    }

    const result = await statusResponse.json();
    console.log(`[crossmint-signer] Transaction status (${attempt + 1}/${maxAttempts}): ${result.status}`);

    if (result.status === 'success' || result.status === 'confirmed') {
      // Crossmint has already submitted the transaction!
      // Extract the signature from the response
      const signature = result.onChain?.txId || result.onChain?.signature;

      if (!signature) {
        console.error('[crossmint-signer] No signature in onChain field:', result.onChain);
        throw new Error('Transaction signature not found in Crossmint response');
      }

      console.log(`[crossmint-signer] Transaction submitted by Crossmint successfully`);
      console.log(`[crossmint-signer] Signature: ${signature}`);

      // Return a mock transaction with the signature embedded
      // The settle function will extract this and skip manual submission
      return {
        signatures: [signature],
        _crossmintSubmitted: true,
        _crossmintSignature: signature,
      } as any;
    }

    if (result.status === 'failed') {
      throw new Error(`Transaction failed: ${result.errorMessage || 'Unknown error'}`);
    }

    // Continue polling for 'pending', 'submitted', or other in-progress statuses
  }

  throw new Error(`Transaction timeout after ${maxAttempts} seconds`);
}
