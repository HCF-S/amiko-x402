import { ExactSvmPayload } from "../../types/verify/x402Specs";
import {
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  type TransactionSigner,
  isTransactionModifyingSigner,
  isTransactionPartialSigner,
  RpcDevnet,
  SolanaRpcApiDevnet,
  RpcMainnet,
  SolanaRpcApiMainnet,
  Transaction,
  CompiledTransactionMessage,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";

/**
 * Given an object with a base64 encoded transaction, decode the
 * base64 encoded transaction into a solana transaction object.
 *
 * @param svmPayload - The SVM payload to decode
 * @returns The decoded transaction
 */
export function decodeTransactionFromPayload(svmPayload: ExactSvmPayload): Transaction {
  try {
    const base64Encoder = getBase64Encoder();
    const transactionBytes = base64Encoder.encode(svmPayload.transaction);
    const transactionDecoder = getTransactionDecoder();
    return transactionDecoder.decode(transactionBytes);
  } catch (error) {
    console.error("error", error);
    throw new Error("invalid_exact_svm_payload_transaction");
  }
}

/**
 * Extract the token sender (owner of the source token account)
 * from the TransferChecked instruction.
 *
 * @param transaction - The transaction to extract the token payer from
 * @returns The token payer address as a base58 string
 */
export function getTokenPayerFromTransaction(transaction: Transaction): string {
  const compiled = getCompiledTransactionMessageDecoder().decode(
    transaction.messageBytes,
  ) as CompiledTransactionMessage;
  const staticAccounts = compiled.staticAccounts ?? [];
  const instructions = compiled.instructions ?? [];

  for (const ix of instructions) {
    const programIndex = ix.programAddressIndex;
    const programAddress = staticAccounts[programIndex].toString();
    if (
      programAddress === TOKEN_PROGRAM_ADDRESS.toString() ||
      programAddress === TOKEN_2022_PROGRAM_ADDRESS.toString()
    ) {
      const accountIndices: number[] = ix.accountIndices ?? [];
      if (accountIndices.length >= 4) {
        // TransferChecked account order: [source, mint, destination, owner, ...]
        const ownerIndex = accountIndices[3];
        const ownerAddress = staticAccounts[ownerIndex].toString();
        if (ownerAddress) return ownerAddress;
      }
    }
  }

  return "";
}

/**
 * Sign and simulate a transaction.
 *
 * @param signer - The signer that will sign the transaction
 * @param transaction - The transaction to sign and simulate
 * @param rpc - The RPC client to use to simulate the transaction
 * @returns The transaction simulation result
 */
export async function signAndSimulateTransaction(
  signer: TransactionSigner,
  transaction: Transaction,
  rpc: RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>,
) {
  const signedTransaction = await signTransactionWithSigner(signer, transaction);

  // serialize the signed transaction into a base64 encoded wire transaction
  const base64EncodedTransaction = getBase64EncodedWireTransaction(signedTransaction);

  // simulate the transaction and verify that it will succeed
  // We use replaceRecentBlockhash: true because there may be delays between when the
  // client creates the transaction and when verification happens. Solana blockhashes
  // expire after ~150 blocks (~1-2 minutes), so we replace it with a fresh one for simulation.
  // This is safe because:
  // 1. The transaction structure and logic are still validated
  // 2. During settlement, a fresh blockhash will be used anyway
  // 3. Signatures are verified on-chain during actual settlement
  // Note: sigVerify must be false when replaceRecentBlockhash is true (Solana RPC limitation)
  const simulateTxConfig = {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    encoding: "base64",
    accounts: undefined,
    innerInstructions: undefined,
    minContextSlot: undefined,
  } as const;

  const simulateResult = await rpc
    .simulateTransaction(base64EncodedTransaction, simulateTxConfig)
    .send();

  return simulateResult;
}

/**
 * Signs a transaction using the provided {@link TransactionSigner}.
 *
 * Prefers modifying signers (wallets that can rewrite the transaction) and falls
 * back to partial signers that only append signatures.
 *
 * @param signer - Wallet or signer capable of producing transaction signatures
 * @param transaction - Compiled transaction to sign
 * @returns The transaction including any signatures added by the signer
 */
export async function signTransactionWithSigner(
  signer: TransactionSigner,
  transaction: Transaction,
): Promise<Transaction> {
  console.log("[signTransactionWithSigner] Signer address:", signer.address);
  console.log("[signTransactionWithSigner] Transaction signatures before:", Object.keys(transaction.signatures));
  
  if (isTransactionModifyingSigner(signer)) {
    console.log("[signTransactionWithSigner] Using modifying signer");
    const [modifiedTransaction] = await signer.modifyAndSignTransactions([transaction]);
    if (!modifiedTransaction) {
      throw new Error("transaction_signer_failed_to_return_transaction");
    }
    return modifiedTransaction;
  }

  if (isTransactionPartialSigner(signer)) {
    console.log("[signTransactionWithSigner] Using partial signer");
    const [signatures] = await signer.signTransactions([transaction]);
    console.log("[signTransactionWithSigner] Signatures returned:", signatures ? Object.keys(signatures) : "null");
    if (!signatures) {
      throw new Error("transaction_signer_failed_to_return_signatures");
    }
    const merged = mergeTransactionSignatures(transaction, signatures);
    console.log("[signTransactionWithSigner] Merged signatures:", Object.keys(merged.signatures));
    // Check if fee payer signature is still null
    for (const [addr, sig] of Object.entries(merged.signatures)) {
      console.log(`[signTransactionWithSigner] ${addr}: ${sig ? 'HAS SIG' : 'NULL'}`);
    }
    return merged;
  }

  throw new Error("transaction_signer_must_support_offline_signing");
}

/**
 * Returns a copy of `transaction` with additional signatures merged in.
 *
 * @param transaction - Transaction whose signature map should be augmented
 * @param signatures - Map of addresses to new signature bytes
 * @returns A frozen transaction containing the merged signature map
 */
function mergeTransactionSignatures(
  transaction: Transaction,
  signatures: Record<string, Uint8Array>,
): Transaction {
  return Object.freeze({
    ...transaction,
    signatures: Object.freeze({
      ...transaction.signatures,
      ...signatures,
    }),
  });
}
