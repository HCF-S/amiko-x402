import {
  getBase64Encoder,
  getTransactionDecoder,
  type Transaction,
} from "@solana/kit";

export function decodeTransaction(base64EncodedTransaction: string): Transaction {
  const base64Encoder = getBase64Encoder();
  const transactionBytes = base64Encoder.encode(base64EncodedTransaction);
  const transactionDecoder = getTransactionDecoder();
  return transactionDecoder.decode(transactionBytes);
}
