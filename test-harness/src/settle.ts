import {
  type Transaction,
  type TransactionSigner,
  getSignatureFromTransaction,
  getBase64EncodedWireTransaction,
} from "@solana/kit";
import { PaymentRequirements } from "./types.js";
import { getRpcClient, getRpcSubscriptions } from "./rpc.js";
import {
  createRecentSignatureConfirmationPromiseFactory,
  createBlockHeightExceedencePromiseFactory,
} from "@solana/transaction-confirmation";
import { decodeTransaction } from "./transaction.js";
import { signTransactionWithSigner, sendAndConfirmTransaction } from "./transaction-utils.js";

export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  transaction: string;
  payer?: string;
}

export async function settle(
  signer: TransactionSigner,
  signedTransactionB64: string,
  paymentRequirements: PaymentRequirements,
  rpcUrl?: string,
): Promise<SettleResponse> {
  const decodedTransaction = decodeTransaction(signedTransactionB64);

  const signedTransaction = await signTransactionWithSigner(
    signer,
    decodedTransaction,
  );

  const rpc = getRpcClient(paymentRequirements.network, rpcUrl);
  const rpcSubscriptions = getRpcSubscriptions(paymentRequirements.network, rpcUrl);

  try {
    const { success, errorReason, signature } = await sendAndConfirmTransaction(
      signedTransaction,
      rpc,
      rpcSubscriptions,
    );

    return {
      success,
      errorReason,
      transaction: signature,
    };
  } catch (error) {
    console.error("Unexpected error during transaction settlement:", error);

    return {
      success: false,
      errorReason: "unexpected_settle_error",
      transaction: getSignatureFromTransaction(signedTransaction),
    };
  }
}
