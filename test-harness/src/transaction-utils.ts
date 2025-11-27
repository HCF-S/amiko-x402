import {
  type Transaction,
  type TransactionSigner,
  getSignatureFromTransaction,
  getBase64EncodedWireTransaction,
  assertIsTransactionMessageWithBlockhashLifetime,
  type Commitment,
  decompileTransactionMessageFetchingLookupTables,
  getCompiledTransactionMessageDecoder,
  isSolanaError,
  type SendTransactionApi,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
  type Rpc,
  type SolanaRpcApi,
  partiallySignTransactionMessageWithSigners,
  decompileTransactionMessage,
} from "@solana/kit";
import {
  createBlockHeightExceedencePromiseFactory,
  waitForRecentTransactionConfirmation,
  createRecentSignatureConfirmationPromiseFactory,
} from "@solana/transaction-confirmation";

export async function signTransactionWithSigner(
  signer: TransactionSigner,
  transaction: Transaction,
): Promise<Transaction> {
  const decoder = getCompiledTransactionMessageDecoder();
  const compiledMessage = decoder.decode(transaction.messageBytes);
  const decompiledMessage = decompileTransactionMessage(compiledMessage);

  const transactionWithSigners = {
    ...decompiledMessage,
    feePayer: signer,
  };

  return await partiallySignTransactionMessageWithSigners(transactionWithSigners);
}

export async function sendAndConfirmTransaction(
  signedTransaction: Transaction,
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: ReturnType<typeof import("./rpc.js").getRpcSubscriptions>,
): Promise<{ success: boolean; errorReason?: string; signature: string }> {
  await sendSignedTransaction(signedTransaction, rpc);
  return await confirmSignedTransaction(signedTransaction, rpc, rpcSubscriptions);
}

async function sendSignedTransaction(
  signedTransaction: Transaction,
  rpc: Rpc<SolanaRpcApi>,
  sendTxConfig: Parameters<SendTransactionApi["sendTransaction"]>[1] = {
    skipPreflight: true,
    encoding: "base64",
  },
): Promise<string> {
  const base64EncodedTransaction = getBase64EncodedWireTransaction(signedTransaction);
  return await rpc.sendTransaction(base64EncodedTransaction, sendTxConfig).send();
}

async function confirmSignedTransaction(
  signedTransaction: Transaction,
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: ReturnType<typeof import("./rpc.js").getRpcSubscriptions>,
): Promise<{ success: boolean; errorReason?: string; signature: string }> {
  const signature = getSignatureFromTransaction(signedTransaction);

  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort("Transaction confirmation timed out after 60 seconds");
  }, 60000);

  try {
    const compiledTransactionMessage = getCompiledTransactionMessageDecoder().decode(
      signedTransaction.messageBytes,
    );
    const decompiledTransactionMessage = await decompileTransactionMessageFetchingLookupTables(
      compiledTransactionMessage,
      rpc,
    );
    assertIsTransactionMessageWithBlockhashLifetime(decompiledTransactionMessage);

    const signedTransactionWithBlockhashLifetime = {
      ...signedTransaction,
      lifetimeConstraint: decompiledTransactionMessage.lifetimeConstraint,
    };

    const commitment: Commitment = "confirmed";

    const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory({
      rpc,
      rpcSubscriptions,
    } as Parameters<typeof createRecentSignatureConfirmationPromiseFactory>[0]);

    const getBlockHeightExceedencePromise = createBlockHeightExceedencePromiseFactory({
      rpc,
      rpcSubscriptions,
    } as Parameters<typeof createBlockHeightExceedencePromiseFactory>[0]);

    const config = {
      abortSignal: abortController.signal,
      commitment,
      getBlockHeightExceedencePromise,
      getRecentSignatureConfirmationPromise,
    };

    await waitForRecentTransactionConfirmation({
      ...config,
      transaction: signedTransactionWithBlockhashLifetime as Parameters<
        typeof waitForRecentTransactionConfirmation
      >[0]["transaction"],
    });

    return {
      success: true,
      signature,
    };
  } catch (error) {
    console.error(error);

    if (isSolanaError(error, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED)) {
      return {
        success: false,
        errorReason: "settle_exact_svm_block_height_exceeded",
        signature,
      };
    } else if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        errorReason: "settle_exact_svm_transaction_confirmation_timed_out",
        signature,
      };
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
}
