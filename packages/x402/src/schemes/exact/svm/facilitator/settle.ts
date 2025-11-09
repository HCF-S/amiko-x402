import {
  SettleResponse,
  PaymentPayload,
  PaymentRequirements,
  ExactSvmPayload,
  ErrorReasons,
} from "../../../../types/verify";
import { X402Config } from "../../../../types/config";
import {
  assertIsTransactionMessageWithBlockhashLifetime,
  Commitment,
  decompileTransactionMessageFetchingLookupTables,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  getSignatureFromTransaction,
  isSolanaError,
  type Transaction,
  type TransactionSigner,
  SendTransactionApi,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
  SolanaRpcApiDevnet,
  SolanaRpcApiMainnet,
  RpcDevnet,
  RpcMainnet,
  decompileTransactionMessage,
  type CompiledTransactionMessage,
} from "@solana/kit";
import {
  decodeTransactionFromPayload,
  getTokenPayerFromTransaction,
  signTransactionWithSigner,
} from "../../../../shared/svm";
import { getRpcClient, getRpcSubscriptions } from "../../../../shared/svm/rpc";
import {
  createBlockHeightExceedencePromiseFactory,
  waitForRecentTransactionConfirmation,
  createRecentSignatureConfirmationPromiseFactory,
} from "@solana/transaction-confirmation";
import { verify } from "./verify";

/**
 * Settle the payment payload against the payment requirements.
 * TODO: handle durable nonce lifetime transactions
 *
 * @param signer - The signer that will sign the transaction
 * @param payload - The payment payload to settle
 * @param paymentRequirements - The payment requirements to settle against
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A SettleResponse indicating if the payment is settled and any error reason
 */
export async function settle(
  signer: TransactionSigner,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<SettleResponse> {
  const verifyResponse = await verify(signer, payload, paymentRequirements, config);
  if (!verifyResponse.isValid) {
    return {
      success: false,
      errorReason: verifyResponse.invalidReason,
      network: payload.network,
      transaction: "",
    };
  }

  const svmPayload = payload.payload as ExactSvmPayload;
  const decodedTransaction = decodeTransactionFromPayload(svmPayload);

  const allowCustodialWallets = config?.svmConfig?.allowCustodialWallets || false;

  // For custodial wallets, the transaction is already signed by the custodial service (like Crossmint)
  // Don't attempt to sign it again with the facilitator's key
  const signedTransaction = allowCustodialWallets
    ? decodedTransaction
    : await signTransactionWithSigner(signer, decodedTransaction);

  // For custodial wallets, skip the full signature check - they provide only the signatures they need to
  if (!allowCustodialWallets) {
    assertTransactionFullySigned(signedTransaction);
  }
  const payer = getTokenPayerFromTransaction(signedTransaction);

  const rpc = getRpcClient(paymentRequirements.network, config?.svmConfig?.rpcUrl);
  const rpcSubscriptions = getRpcSubscriptions(
    paymentRequirements.network,
    config?.svmConfig?.rpcUrl,
  );

  try {
    const { success, errorReason, signature } = await sendAndConfirmSignedTransaction(
      signedTransaction,
      rpc,
      rpcSubscriptions,
    );

    // Extract job ID if this is a trustless transaction
    const jobId = extractJobIdFromTransaction(signedTransaction);

    return {
      success,
      errorReason,
      payer,
      transaction: signature,
      network: payload.network,
      jobId,
    };
  } catch (error) {
    console.error("Unexpected error during transaction settlement:", error);
    
    // Extract job ID even on error for potential retry scenarios
    const jobId = extractJobIdFromTransaction(signedTransaction);
    
    return {
      success: false,
      errorReason: "unexpected_settle_error",
      network: payload.network,
      transaction: getSignatureFromTransaction(signedTransaction),
      payer,
      jobId,
    };
  }
}

/**
 * Send a signed transaction to the RPC.
 * TODO: should this be moved to the shared/svm/rpc.ts file?
 *
 * @param signedTransaction - The signed transaction to send
 * @param rpc - The RPC client to use to send the transaction
 * @param sendTxConfig - The configuration for the transaction send
 * @returns The signature of the sent transaction
 */
export async function sendSignedTransaction(
  signedTransaction: Transaction,
  rpc: RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>,
  sendTxConfig: Parameters<SendTransactionApi["sendTransaction"]>[1] = {
    skipPreflight: true,
    encoding: "base64",
  },
): Promise<string> {
  const base64EncodedTransaction = getBase64EncodedWireTransaction(signedTransaction);
  return await rpc.sendTransaction(base64EncodedTransaction, sendTxConfig).send();
}

/**
 * Confirm a signed transaction.
 * TODO: can some of this be refactored to be moved to the shared/svm/rpc.ts file?
 * TODO: should the commitment and the timeout be passed in as parameters?
 *
 * @param signedTransaction - The signed transaction to confirm
 * @param rpc - The RPC client to use to confirm the transaction
 * @param rpcSubscriptions - The RPC subscriptions to use to confirm the transaction
 * @returns The success and signature of the confirmed transaction
 */
export async function confirmSignedTransaction(
  signedTransaction: Transaction,
  rpc: RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>,
  rpcSubscriptions: ReturnType<typeof getRpcSubscriptions>,
): Promise<{ success: boolean; errorReason?: (typeof ErrorReasons)[number]; signature: string }> {
  // get the signature from the signed transaction
  const signature = getSignatureFromTransaction(signedTransaction);

  // set a timeout for the transaction confirmation
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort("Transaction confirmation timed out after 60 seconds");
  }, 60000);

  try {
    // decompile the transaction message to get the blockhash lifetime
    const compiledTransactionMessage = getCompiledTransactionMessageDecoder().decode(
      signedTransaction.messageBytes,
    );
    const decompiledTransactionMessage = await decompileTransactionMessageFetchingLookupTables(
      compiledTransactionMessage,
      rpc,
    );
    assertIsTransactionMessageWithBlockhashLifetime(decompiledTransactionMessage);

    // add the blockhash lifetime to the signed transaction
    const signedTransactionWithBlockhashLifetime = {
      ...signedTransaction,
      lifetimeConstraint: decompiledTransactionMessage.lifetimeConstraint,
    };

    // create the config for the transaction confirmation
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

    // wait for the transaction to be confirmed
    await waitForRecentTransactionConfirmation({
      ...config,
      transaction: signedTransactionWithBlockhashLifetime as Parameters<
        typeof waitForRecentTransactionConfirmation
      >[0]["transaction"],
    });

    // return the success and signature
    return {
      success: true,
      signature,
    };
  } catch (error) {
    console.error(error);

    // block height exceeded error
    if (isSolanaError(error, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED)) {
      return {
        success: false,
        errorReason: "settle_exact_svm_block_height_exceeded",
        signature,
      };
    }
    // transaction confirmation timed out error
    else if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        errorReason: "settle_exact_svm_transaction_confirmation_timed_out",
        signature,
      };
    }
    // unexpected error
    else {
      throw error;
    }
  } finally {
    // clear the timeout
    clearTimeout(timeout);
  }
}

/**
 * Send and confirm a signed transaction.
 *
 * @param signedTransaction - The signed transaction to send and confirm
 * @param rpc - The RPC client to use to send and confirm the transaction
 * @param rpcSubscriptions - The RPC subscriptions to use to send and confirm the transaction
 * @returns The success and signature of the confirmed transaction
 */
export async function sendAndConfirmSignedTransaction(
  signedTransaction: Transaction,
  rpc: RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>,
  rpcSubscriptions: ReturnType<typeof getRpcSubscriptions>,
): Promise<{ success: boolean; errorReason?: (typeof ErrorReasons)[number]; signature: string }> {
  await sendSignedTransaction(signedTransaction, rpc);
  return await confirmSignedTransaction(signedTransaction, rpc, rpcSubscriptions);
}

/**
 * Ensures the provided transaction contains a signature for every required address.
 *
 * @param transaction - Transaction to verify for complete signatures
 */
function assertTransactionFullySigned(transaction: Transaction): void {
  const missingAddresses = Object.entries(transaction.signatures)
    .filter(([, signature]) => signature == null)
    .map(([address]) => address);

  if (missingAddresses.length > 0) {
    throw new Error(`transaction_signer_missing_signatures:${missingAddresses.join(",")}`);
  }
}

/**
 * Extracts the job ID from a trustless transaction.
 * The job ID is the first account (job_record PDA) in the register_job instruction.
 *
 * @param transaction - The signed transaction
 * @returns The job ID (job_record PDA address) if found, undefined otherwise
 */
function extractJobIdFromTransaction(transaction: Transaction): string | undefined {
  try {
    // Decode the transaction message
    const compiledMessage = getCompiledTransactionMessageDecoder().decode(
      transaction.messageBytes
    ) as CompiledTransactionMessage;
    
    // Decompile to get instructions
    const decompiledMessage = decompileTransactionMessage(compiledMessage);
    
    // The register_job instruction discriminator (first 8 bytes of sha256("global:register_job"))
    const REGISTER_JOB_DISCRIMINATOR = new Uint8Array([0x57, 0xd5, 0xb1, 0xff, 0x83, 0x11, 0xb2, 0x2d]);
    
    // Find the register_job instruction (should be the last instruction)
    const registerJobIx = decompiledMessage.instructions.find((ix) => {
      if (!ix.data || ix.data.length < 8) return false;
      const discriminator = new Uint8Array(ix.data.slice(0, 8));
      return discriminator.every((byte, index) => byte === REGISTER_JOB_DISCRIMINATOR[index]);
    });
    
    if (!registerJobIx || !registerJobIx.accounts || registerJobIx.accounts.length === 0) {
      return undefined;
    }
    
    // The first account in the register_job instruction is the job_record PDA (the job ID)
    const jobRecordAccount = registerJobIx.accounts[0];
    return jobRecordAccount.address;
  } catch (error) {
    console.error("Failed to extract job ID from transaction:", error);
    return undefined;
  }
}
