import { encodePayment } from "../../utils";
import {
  Address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  partiallySignTransactionMessageWithSigners,
  prependTransactionMessageInstruction,
  getBase64EncodedWireTransaction,
  fetchEncodedAccount,
  TransactionSigner,
  Instruction,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getCompiledTransactionMessageEncoder,
  compileTransactionMessage,
} from "@solana/kit";
import { PaymentPayload, PaymentRequirements } from "../../../types/verify";
import { X402Config } from "../../../types/config";
import {
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstruction,
  getTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  estimateComputeUnitLimitFactory,
  getSetComputeUnitLimitInstruction,
  setTransactionMessageComputeUnitPrice,
} from "@solana-program/compute-budget";
import { getRpcClient } from "../../../shared/svm/rpc";

/**
 * Creates and encodes a payment header for the given client and payment requirements.
 *
 * @param client - The signer instance used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A promise that resolves to a base64 encoded payment header string
 */
export async function createPaymentHeader(
  client: TransactionSigner,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<string> {
  const paymentPayload = await createAndSignPayment(
    client,
    x402Version,
    paymentRequirements,
    config,
  );
  return encodePayment(paymentPayload);
}

/**
 * Creates and signs a payment for the given client and payment requirements.
 *
 * @param client - The signer instance used to create and sign the payment tx
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A promise that resolves to a payment payload containing a base64 encoded solana token transfer tx
 */
export async function createAndSignPayment(
  client: TransactionSigner,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<PaymentPayload> {
  const transactionMessage = await createTransferTransactionMessage(
    client,
    paymentRequirements,
    config,
  );
  const signedTransaction = await partiallySignTransactionMessageWithSigners(transactionMessage);
  const base64EncodedWireTransaction = getBase64EncodedWireTransaction(signedTransaction);

  // return payment payload
  return {
    scheme: paymentRequirements.scheme,
    network: paymentRequirements.network,
    x402Version: x402Version,
    payload: {
      transaction: base64EncodedWireTransaction,
    },
  } as PaymentPayload;
}

/**
 * Creates an unsigned transfer transaction for the given wallet address and payment requirements.
 * This is used by facilitators to prepare transactions for clients to sign.
 *
 * @param walletAddress - The wallet address that will sign and pay for the transaction
 * @param paymentRequirements - The payment requirements
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A promise that resolves to a base64 encoded unsigned transaction
 */
export async function createUnsignedTransaction(
  walletAddress: string,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<string> {
  // Create a mock signer with the wallet address
  const mockSigner: TransactionSigner = {
    address: walletAddress as Address,
    signTransactions: async () => { throw new Error("Not implemented"); },
  };

  // For trustless transactions, we need to create a mock signer for the facilitator too
  // so that the transaction message header includes both required signers
  const feePayer = paymentRequirements.extra?.feePayer as Address | undefined;
  const isTrustless = !!config?.svmConfig?.trustlessProgramId;

  let transactionMessage;
  if (isTrustless && feePayer) {
    // Create mock signer for facilitator
    const facilitatorMockSigner: TransactionSigner = {
      address: feePayer,
      signTransactions: async () => { throw new Error("Not implemented"); },
    };

    // Pass facilitator signer in config so it can be used when building the transaction
    const configWithFacilitatorSigner = {
      ...config,
      svmConfig: {
        ...config?.svmConfig,
        facilitatorSigner: facilitatorMockSigner,
      },
    };

    transactionMessage = await createTransferTransactionMessage(
      mockSigner,
      paymentRequirements,
      configWithFacilitatorSigner as X402Config,
    );
  } else {
    transactionMessage = await createTransferTransactionMessage(
      mockSigner,
      paymentRequirements,
      config,
    );
  }

  // Compile the transaction message
  const compiledTransactionMessage = compileTransactionMessage(transactionMessage);

  // Serialize the compiled transaction message to base64
  const encoder = getCompiledTransactionMessageEncoder();
  const encodedMessage = encoder.encode(compiledTransactionMessage);

  // Convert to base64
  return btoa(String.fromCharCode(...encodedMessage));
}

/**
 * Creates a transfer transaction message for the given client and payment requirements.
 *
 * @param client - The signer instance used to create the transfer transaction message
 * @param paymentRequirements - The payment requirements
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A promise that resolves to the transaction message with the transfer instruction
 */
async function createTransferTransactionMessage(
  client: TransactionSigner,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
) {
  const rpc = getRpcClient(paymentRequirements.network, config?.svmConfig?.rpcUrl);

  // create the transfer instruction
  const transferInstructions = await createAtaAndTransferInstructions(
    client,
    paymentRequirements,
    config,
  );

  // create tx to simulate
  const feePayer = paymentRequirements.extra?.feePayer as Address;
  const txToSimulate = pipe(
    createTransactionMessage({ version: 0 }),
    tx => prependTransactionMessageInstruction(
      getSetComputeUnitLimitInstruction({ units: 200_000 }), // default limit
      tx,
    ),
    tx => setTransactionMessageComputeUnitPrice(1, tx), // 1 microlamport priority fee
    tx => setTransactionMessageFeePayer(feePayer, tx),
    tx => appendTransactionMessageInstructions(transferInstructions, tx),
  );

  // finalize the transaction message by adding the blockhash
  // Note: compute unit limit is already set with default 200k units
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const tx = pipe(
    txToSimulate,
    tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  );

  return tx;
}

/**
 * Creates a transfer instruction for the given client and payment requirements.
 * This function will determine which transfer instruction to create
 * based on the program that created the token (token-2022 or token).
 *
 * @param client - The signer instance used to create the transfer instruction
 * @param paymentRequirements - The payment requirements
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A promise that resolves to the create ATA (if needed) and transfer instruction
 */
async function createAtaAndTransferInstructions(
  client: TransactionSigner,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<Instruction[]> {
  const { asset } = paymentRequirements;

  const rpc = getRpcClient(paymentRequirements.network, config?.svmConfig?.rpcUrl);
  const tokenMint = await fetchMint(rpc, asset as Address);
  const tokenProgramAddress = tokenMint.programAddress;

  // validate that the asset was created by a known token program
  if (
    tokenProgramAddress.toString() !== TOKEN_PROGRAM_ADDRESS.toString() &&
    tokenProgramAddress.toString() !== TOKEN_2022_PROGRAM_ADDRESS.toString()
  ) {
    throw new Error("Asset was not created by a known token program");
  }

  const instructions: Instruction[] = [];

  // create the ATA (if needed)
  const createAtaIx = await createAtaInstructionOrUndefined(
    paymentRequirements,
    tokenProgramAddress,
    config,
  );
  if (createAtaIx) {
    instructions.push(createAtaIx);
  }

  // create the transfer instruction
  const transferIx = await createTransferInstruction(
    client,
    paymentRequirements,
    tokenMint.data.decimals,
    tokenProgramAddress,
  );
  instructions.push(transferIx);

  // create the register_job instruction if trustless program ID is provided
  if (config?.svmConfig?.trustlessProgramId) {
    // Calculate the transfer instruction index in the final transaction:
    // Final transaction order:
    // 0: SetComputeUnitPrice (compute budget instruction)
    // 1: SetComputeUnitLimit (compute budget instruction)
    // 2+: Our instructions (ATA?, Transfer, RegisterJob)
    //
    // Transfer is the last instruction BEFORE RegisterJob
    const computeBudgetInstructionCount = 2;
    const transferInstructionIndex = computeBudgetInstructionCount + (instructions.length - 1);

    const registerJobIx = await createRegisterJobInstruction(
      client,
      paymentRequirements,
      tokenProgramAddress,
      config.svmConfig.trustlessProgramId,
      transferInstructionIndex,
      config, // Pass config so we can get facilitator signer
    );
    instructions.push(registerJobIx);
  }

  return instructions;
}

/**
 * Returns a create ATA instruction for the payTo address if the ATA account does not exist.
 * The create ATA instruction will be paid for by the feePayer in the payment requirements.
 *
 * This function will work for both spl-token and token-2022.
 *
 * Returns undefined if the ATA account already exists.
 *
 * @param paymentRequirements - The payment requirements
 * @param tokenProgramAddress - The address of the token program
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A promise that resolves to the create ATA instruction or undefined if the ATA account already exists
 * @throws an error if the feePayer is not provided in the payment requirements
 */
async function createAtaInstructionOrUndefined(
  paymentRequirements: PaymentRequirements,
  tokenProgramAddress: Address,
  config?: X402Config,
): Promise<Instruction | undefined> {
  const { asset, payTo, extra } = paymentRequirements;
  const feePayer = extra?.feePayer as Address;

  // feePayer is required
  if (!feePayer) {
    throw new Error(
      "feePayer is required in paymentRequirements.extra in order to set the " +
        "facilitator as the fee payer for the create associated token account instruction",
    );
  }

  // derive the ATA of the payTo address
  const [destinationATAAddress] = await findAssociatedTokenPda({
    mint: asset as Address,
    owner: payTo as Address,
    tokenProgram: tokenProgramAddress,
  });

  // check if the ATA exists
  const rpc = getRpcClient(paymentRequirements.network, config?.svmConfig?.rpcUrl);
  const maybeAccount = await fetchEncodedAccount(rpc, destinationATAAddress);

  // if the ATA does not exist, return an instruction to create it
  if (!maybeAccount.exists) {
    return getCreateAssociatedTokenInstruction({
      payer: paymentRequirements.extra?.feePayer as TransactionSigner<string>,
      ata: destinationATAAddress,
      owner: payTo as Address,
      mint: asset as Address,
      tokenProgram: tokenProgramAddress,
    });
  }

  // if the ATA exists, return undefined
  return undefined;
}

/**
 * Creates a transfer instruction for the given client and payment requirements.
 * This function will create a transfer instruction for a token created by either
 * the token program or the token-2022 program.
 *
 * @param client - The signer instance who's tokens will be debited from
 * @param paymentRequirements - The payment requirements
 * @param decimals - The decimals of the token
 * @param tokenProgramAddress - The address of the token program
 * @returns A promise that resolves to the transfer instruction
 */
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

/**
 * Creates a register_job instruction for the trustless program.
 * This instruction registers the payment as a job on-chain.
 *
 * @param client - The signer instance (client wallet)
 * @param paymentRequirements - The payment requirements
 * @param tokenProgramAddress - The address of the token program
 * @param trustlessProgramId - The address of the trustless program
 * @param transferInstructionIndex - The index of the transfer instruction in the transaction
 * @param config - Optional configuration for X402 operations (provides facilitator signer)
 * @returns A promise that resolves to the register_job instruction
 */
async function createRegisterJobInstruction(
  client: TransactionSigner,
  paymentRequirements: PaymentRequirements,
  tokenProgramAddress: Address,
  trustlessProgramId: string,
  transferInstructionIndex: number,
  config?: X402Config,
): Promise<Instruction> {
  const { asset, payTo, extra } = paymentRequirements;
  const programId = address(trustlessProgramId);

  // Get facilitator signer from config (for trustless transactions)
  // This ensures the facilitator is properly included as a signer in the transaction message
  const facilitatorSigner = config?.svmConfig?.facilitatorSigner as TransactionSigner | undefined;

  // Extract fee payer address from paymentRequirements.extra, default to client address
  const feePayerAddress = (extra?.feePayer as Address) || client.address;

  // Generate a unique identifier to use as the payment_tx address
  // This serves as a unique job ID and is used to derive the job_record PDA
  // We use a random 32-byte value and encode it as a base58 address
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  // Convert to base58 string (Solana address format)
  const bs58 = await import("@scure/base");
  const paymentTxAddress = address(bs58.base58.encode(randomBytes));

  // Derive client token account
  const [clientTokenAccount] = await findAssociatedTokenPda({
    mint: asset as Address,
    owner: client.address,
    tokenProgram: tokenProgramAddress,
  });

  // Derive agent token account
  const [agentTokenAccount] = await findAssociatedTokenPda({
    mint: asset as Address,
    owner: payTo as Address,
    tokenProgram: tokenProgramAddress,
  });

  // Derive agent account PDA
  const agentAccountSeeds = [
    new Uint8Array(Buffer.from("agent")),
    new Uint8Array(getAddressEncoder().encode(payTo as Address))
  ];
  const [agentAccount] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: agentAccountSeeds,
  });

  // Derive job record PDA using the payment_tx address as seed
  const jobRecordSeeds = [
    new Uint8Array(Buffer.from("job")),
    new Uint8Array(getAddressEncoder().encode(paymentTxAddress))
  ];
  const [jobRecord] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: jobRecordSeeds,
  });

  // Instruction discriminator for register_job (Anchor uses first 8 bytes of sha256("global:register_job"))
  const discriminator = Buffer.from([0x57, 0xd5, 0xb1, 0xff, 0x83, 0x11, 0xb2, 0x2d]);

  // Instruction data: discriminator + transfer_instruction_index (u8)
  const data = Buffer.concat([discriminator, Buffer.from([transferInstructionIndex])]);

  // Build accounts list
  // For trustless transactions, use the facilitator TransactionSigner so it's properly registered
  // as a required signer in the transaction message. Otherwise just use the address.
  const accounts: any[] = [
    { address: jobRecord, role: 1 }, // job_record (writable)
    { address: agentAccount, role: 1 }, // agent_account (writable)
    { address: payTo as Address, role: 0 }, // agent_wallet (readonly)
    { address: clientTokenAccount, role: 0 }, // client_token_account (readonly)
    { address: agentTokenAccount, role: 0 }, // agent_token_account (readonly)
    { address: paymentTxAddress, role: 0 }, // payment_tx (readonly, unique job identifier)
    { address: address("Sysvar1nstructions1111111111111111111111111"), role: 0 }, // instruction_sysvar
    client, // client_wallet (signer) - TransactionSigner auto-converts to signer metadata
  ];

  // Add fee payer - use TransactionSigner if available (for trustless), otherwise just address
  if (facilitatorSigner) {
    accounts.push(facilitatorSigner); // TransactionSigner auto-converts to signer + writable metadata
  } else {
    accounts.push({ address: feePayerAddress, role: 3 }); // Manually specify signer + writable
  }

  accounts.push(
    { address: address("11111111111111111111111111111111"), role: 0 }, // system_program
    { address: tokenProgramAddress, role: 0 }, // token_program (readonly)
  );

  return {
    programAddress: programId,
    accounts,
    data,
  };
}
