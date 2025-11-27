import {
  Address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  prependTransactionMessageInstruction,
  TransactionSigner,
  Instruction,
  address,
  compileTransactionMessage,
  getCompiledTransactionMessageEncoder,
} from "@solana/kit";
import { PaymentRequirements } from "./types.js";
import {
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstruction,
  getTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  getSetComputeUnitLimitInstruction,
  setTransactionMessageComputeUnitPrice,
} from "@solana-program/compute-budget";
import { getRpcClient } from "./rpc.js";

export async function prepare(
  walletAddress: string,
  paymentRequirements: PaymentRequirements,
  feePayerAddress: string,
  rpcUrl?: string,
): Promise<string> {
  const mockSigner: TransactionSigner = {
    address: walletAddress as Address,
    signTransactions: async () => {
      throw new Error("Not implemented");
    },
  };

  const feePayer = feePayerAddress as Address;
  const enrichedPaymentRequirements: PaymentRequirements = {
    ...paymentRequirements,
    extra: {
      ...paymentRequirements.extra,
      feePayer,
    },
  };

  const transactionMessage = await createTransferTransactionMessage(
    mockSigner,
    enrichedPaymentRequirements,
    rpcUrl,
  );

  const compiledTransactionMessage = compileTransactionMessage(transactionMessage);
  const encoder = getCompiledTransactionMessageEncoder();
  const encodedMessage = encoder.encode(compiledTransactionMessage);

  const { getBase64Decoder } = await import("@solana/kit");
  const base64Decoder = getBase64Decoder();
  return base64Decoder.decode(encodedMessage);
}

async function createTransferTransactionMessage(
  client: TransactionSigner,
  paymentRequirements: PaymentRequirements,
  rpcUrl?: string,
) {
  const rpc = getRpcClient(paymentRequirements.network, rpcUrl);

  const transferInstructions = await createAtaAndTransferInstructions(
    client,
    paymentRequirements,
    rpcUrl,
  );

  const feePayer = paymentRequirements.extra?.feePayer as Address;
  const txToSimulate = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) =>
      prependTransactionMessageInstruction(
        getSetComputeUnitLimitInstruction({ units: 200_000 }),
        tx,
      ),
    (tx) => setTransactionMessageComputeUnitPrice(1, tx),
    (tx) => setTransactionMessageFeePayer(feePayer, tx),
    (tx) => appendTransactionMessageInstructions(transferInstructions, tx),
  );

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const tx = pipe(
    txToSimulate,
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  );

  return tx;
}

async function createAtaAndTransferInstructions(
  client: TransactionSigner,
  paymentRequirements: PaymentRequirements,
  rpcUrl?: string,
): Promise<Instruction[]> {
  const { asset } = paymentRequirements;

  const rpc = getRpcClient(paymentRequirements.network, rpcUrl);
  const tokenMint = await fetchMint(rpc, asset as Address);
  const tokenProgramAddress = tokenMint.programAddress;

  if (
    tokenProgramAddress.toString() !== TOKEN_PROGRAM_ADDRESS.toString() &&
    tokenProgramAddress.toString() !== TOKEN_2022_PROGRAM_ADDRESS.toString()
  ) {
    throw new Error("Asset was not created by a known token program");
  }

  const instructions: Instruction[] = [];

  const createAtaIx = await createAtaInstructionOrUndefined(
    paymentRequirements,
    tokenProgramAddress,
    rpcUrl,
  );
  if (createAtaIx) {
    instructions.push(createAtaIx);
  }

  const transferIx = await createTransferInstruction(
    client,
    paymentRequirements,
    tokenMint.data.decimals,
    tokenProgramAddress,
  );
  instructions.push(transferIx);

  return instructions;
}

async function createAtaInstructionOrUndefined(
  paymentRequirements: PaymentRequirements,
  tokenProgramAddress: Address,
  rpcUrl?: string,
): Promise<Instruction | undefined> {
  const { asset, payTo, extra } = paymentRequirements;
  const feePayer = extra?.feePayer as Address;

  if (!feePayer) {
    throw new Error(
      "feePayer is required in paymentRequirements.extra in order to set the " +
        "facilitator as the fee payer for the create associated token account instruction",
    );
  }

  const [destinationATAAddress] = await findAssociatedTokenPda({
    mint: asset as Address,
    owner: payTo as Address,
    tokenProgram: tokenProgramAddress,
  });

  const rpc = getRpcClient(paymentRequirements.network, rpcUrl);
  const { fetchEncodedAccount } = await import("@solana/kit");
  const maybeAccount = await fetchEncodedAccount(rpc, destinationATAAddress);

  if (!maybeAccount.exists) {
    return getCreateAssociatedTokenInstruction({
      payer: feePayer as unknown as TransactionSigner<string>,
      ata: destinationATAAddress,
      owner: payTo as Address,
      mint: asset as Address,
      tokenProgram: tokenProgramAddress,
    });
  }

  return undefined;
}

async function createTransferInstruction(
  client: TransactionSigner,
  paymentRequirements: PaymentRequirements,
  decimals: number,
  tokenProgramAddress: Address,
): Promise<Instruction> {
  const { asset, maxAmountRequired: amount, payTo } = paymentRequirements;

  const [sourceATA] = await findAssociatedTokenPda({
    mint: asset as Address,
    owner: client.address,
    tokenProgram: tokenProgramAddress,
  });

  const [destinationATA] = await findAssociatedTokenPda({
    mint: asset as Address,
    owner: payTo as Address,
    tokenProgram: tokenProgramAddress,
  });

  return getTransferCheckedInstruction(
    {
      source: sourceATA,
      mint: asset as Address,
      destination: destinationATA,
      authority: client,
      amount: BigInt(amount),
      decimals: decimals,
    },
    { programAddress: tokenProgramAddress },
  );
}
