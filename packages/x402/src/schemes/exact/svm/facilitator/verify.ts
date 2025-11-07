import {
  VerifyResponse,
  PaymentPayload,
  PaymentRequirements,
  ExactSvmPayload,
  ErrorReasons,
} from "../../../../types/verify";
import { SupportedSVMNetworks } from "../../../../types/shared";
import { X402Config } from "../../../../types/config";
import {
  Address,
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  CompilableTransactionMessage,
  decompileTransactionMessage,
  fetchEncodedAccounts,
  getCompiledTransactionMessageDecoder,
  type TransactionSigner,
  SolanaRpcApiDevnet,
  SolanaRpcApiMainnet,
  RpcDevnet,
  RpcMainnet,
  Instruction,
  AccountLookupMeta,
  AccountMeta,
  InstructionWithData,
} from "@solana/kit";
import {
  parseSetComputeUnitLimitInstruction,
  parseSetComputeUnitPriceInstruction,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
} from "@solana-program/compute-budget";
import {
  findAssociatedTokenPda,
  identifyToken2022Instruction,
  parseCreateAssociatedTokenInstruction,
  parseTransferCheckedInstruction as parseTransferCheckedInstruction2022,
  Token2022Instruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
  identifyTokenInstruction,
  parseTransferCheckedInstruction as parseTransferCheckedInstructionToken,
  TOKEN_PROGRAM_ADDRESS,
  TokenInstruction,
} from "@solana-program/token";
import {
  decodeTransactionFromPayload,
  signAndSimulateTransaction,
  getTokenPayerFromTransaction,
} from "../../../../shared/svm";
import { getRpcClient } from "../../../../shared/svm/rpc";
import { SCHEME } from "../../";

/**
 * Verify the payment payload against the payment requirements.
 *
 * @param signer - The signer that will sign and simulate the transaction
 * @param payload - The payment payload to verify
 * @param paymentRequirements - The payment requirements to verify against
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A VerifyResponse indicating if the payment is valid and any invalidation reason
 */
export async function verify(
  signer: TransactionSigner,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse> {
  try {
    // verify that the scheme and network are supported
    verifySchemesAndNetworks(payload, paymentRequirements);

    // decode the base64 encoded transaction
    const svmPayload = payload.payload as ExactSvmPayload;
    const decodedTransaction = decodeTransactionFromPayload(svmPayload);
    const rpc = getRpcClient(paymentRequirements.network, config?.svmConfig?.rpcUrl);

    // perform transaction introspection to validate the transaction structure and details
    await transactionIntrospection(svmPayload, paymentRequirements, signer, config);

    // simulate the transaction to ensure it will execute successfully
    const simulateResult = await signAndSimulateTransaction(signer, decodedTransaction, rpc);
    if (simulateResult.value?.err) {
      throw new Error(`invalid_exact_svm_payload_transaction_simulation_failed`);
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: getTokenPayerFromTransaction(decodedTransaction),
    };
  } catch (error) {
    // if the error is one of the known error reasons, return the error reason
    if (error instanceof Error) {
      if (ErrorReasons.includes(error.message as (typeof ErrorReasons)[number])) {
        return {
          isValid: false,
          invalidReason: error.message as (typeof ErrorReasons)[number],
          payer: (() => {
            try {
              const tx = decodeTransactionFromPayload(payload.payload as ExactSvmPayload);
              return getTokenPayerFromTransaction(tx);
            } catch {
              return undefined;
            }
          })(),
        };
      }
    }

    // if the error is not one of the known error reasons, return an unexpected error reason
    console.error(error);
    return {
      isValid: false,
      invalidReason: "unexpected_verify_error",
      payer: (() => {
        try {
          const tx = decodeTransactionFromPayload(payload.payload as ExactSvmPayload);
          return getTokenPayerFromTransaction(tx);
        } catch {
          return undefined;
        }
      })(),
    };
  }
}

/**
 * Verify that the scheme and network are supported.
 *
 * @param payload - The payment payload to verify
 * @param paymentRequirements - The payment requirements to verify against
 */
export function verifySchemesAndNetworks(
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): void {
  if (payload.scheme !== SCHEME || paymentRequirements.scheme !== SCHEME) {
    throw new Error("unsupported_scheme");
  }

  if (
    payload.network !== paymentRequirements.network ||
    !SupportedSVMNetworks.includes(paymentRequirements.network)
  ) {
    throw new Error("invalid_network");
  }
}

/**
 * Perform transaction introspection to validate the transaction structure and transfer details.
 * This function handles decoding the transaction, validating the transfer instruction,
 * and verifying all transfer details against the payment requirements.
 *
 * @param svmPayload - The SVM payload containing the transaction
 * @param paymentRequirements - The payment requirements to verify against
 * @param signer - The signer that will sign the transaction
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 */
export async function transactionIntrospection(
  svmPayload: ExactSvmPayload,
  paymentRequirements: PaymentRequirements,
  signer: TransactionSigner,
  config?: X402Config,
): Promise<void> {
  const rpc = getRpcClient(paymentRequirements.network, config?.svmConfig?.rpcUrl);
  const decodedTransaction = decodeTransactionFromPayload(svmPayload);
  const compiledTransactionMessage = getCompiledTransactionMessageDecoder().decode(
    decodedTransaction.messageBytes,
  );
  const transactionMessage: CompilableTransactionMessage = decompileTransactionMessage(
    compiledTransactionMessage,
  );

  await verifyTransactionInstructions(transactionMessage, paymentRequirements, signer, rpc);
}

// Trustless program ID
const TRUSTLESS_PROGRAM_ADDRESS = "GPd4z3N25UfjrkgfgSxsjoyG7gwYF8Fo7Emvp9TKsDeW" as Address;

// Register job instruction discriminator from trustless program
const REGISTER_JOB_DISCRIMINATOR = new Uint8Array([87, 213, 177, 255, 131, 17, 178, 45]);

/**
 * Check if an instruction is a trustless register_job instruction
 */
function isTrustlessRegisterJobInstruction(
  instruction: Instruction<
    string,
    readonly (AccountLookupMeta<string, string> | AccountMeta<string>)[]
  >,
): boolean {
  if (instruction.programAddress.toString() !== TRUSTLESS_PROGRAM_ADDRESS.toString()) {
    return false;
  }

  if (!instruction.data || instruction.data.length < 8) {
    return false;
  }

  // Check if the first 8 bytes match the register_job discriminator
  const discriminator = new Uint8Array(instruction.data.slice(0, 8));
  return discriminator.every((byte, index) => byte === REGISTER_JOB_DISCRIMINATOR[index]);
}

/**
 * Verify that the transaction contains the expected instructions.
 * Supports both transactions with and without trustless register_job instruction.
 *
 * Transaction patterns:
 * - Without trustless: [compute_limit, compute_price, transfer] or [compute_limit, compute_price, create_ata, transfer]
 * - With trustless: [compute_limit, compute_price, transfer, register_job] or [compute_limit, compute_price, create_ata, transfer, register_job]
 *
 * @param transactionMessage - The transaction message to verify
 * @param paymentRequirements - The payment requirements to verify against
 * @param signer - The signer that will sign the transaction
 * @param rpc - The RPC client to use for verifying account existence
 * @throws Error if the transaction does not contain the expected instructions
 */
export async function verifyTransactionInstructions(
  transactionMessage: CompilableTransactionMessage,
  paymentRequirements: PaymentRequirements,
  signer: TransactionSigner,
  rpc: RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>,
) {
  const instructionCount = transactionMessage.instructions.length;

  // Check if the last instruction is a trustless register_job instruction
  const hasTrustlessInstruction =
    instructionCount >= 4 &&
    isTrustlessRegisterJobInstruction(
      transactionMessage.instructions[instructionCount - 1],
    );

  // Calculate the expected instruction count based on whether trustless is present
  // Without trustless: 3-4 instructions (compute_limit, compute_price, [create_ata], transfer)
  // With trustless: 4-5 instructions (compute_limit, compute_price, [create_ata], transfer, register_job)
  const expectedMinInstructions = hasTrustlessInstruction ? 4 : 3;
  const expectedMaxInstructions = hasTrustlessInstruction ? 5 : 4;

  // Validate the number of expected instructions
  if (instructionCount < expectedMinInstructions || instructionCount > expectedMaxInstructions) {
    throw new Error(`invalid_exact_svm_payload_transaction_instructions_length`);
  }

  // Verify that the compute limit and price instructions are valid
  verifyComputeLimitInstruction(transactionMessage.instructions[0]);
  verifyComputePriceInstruction(transactionMessage.instructions[1]);

  // Verify that the fee payer is not included in any instruction's accounts
  // (except for the trustless register_job instruction which may include the fee payer)
  transactionMessage.instructions.forEach((instruction, index) => {
    const isTrustlessInstruction = hasTrustlessInstruction && index === instructionCount - 1;
    if (!isTrustlessInstruction) {
      if (instruction.accounts?.some(account => account.address === signer.address)) {
        throw new Error(
          `invalid_exact_svm_payload_transaction_fee_payer_included_in_instruction_accounts`,
        );
      }
    }
  });

  // Determine the transfer instruction index based on whether create_ata is present
  // Without create_ata: transfer is at index 2
  // With create_ata: create_ata is at index 2, transfer is at index 3
  const hasCreateATA = hasTrustlessInstruction
    ? instructionCount === 5
    : instructionCount === 4;

  if (hasCreateATA) {
    // Verify that the create ATA instruction is valid
    verifyCreateATAInstruction(transactionMessage.instructions[2], paymentRequirements);
    // Verify that the transfer instruction is valid
    await verifyTransferInstruction(
      transactionMessage.instructions[3],
      paymentRequirements,
      {
        txHasCreateDestATAInstruction: true,
      },
      signer,
      rpc,
    );
  } else {
    // Verify that the transfer instruction is valid
    await verifyTransferInstruction(
      transactionMessage.instructions[2],
      paymentRequirements,
      {
        txHasCreateDestATAInstruction: false,
      },
      signer,
      rpc,
    );
  }

  // Note: We don't verify the trustless register_job instruction itself
  // as it's optional and its validation is handled by the Solana runtime
}

/**
 * Verify that the compute limit instruction is valid.
 *
 * @param instruction - The compute limit instruction to verify
 * @throws Error if the compute limit instruction is invalid
 */
export function verifyComputeLimitInstruction(
  instruction: Instruction<
    string,
    readonly (AccountLookupMeta<string, string> | AccountMeta<string>)[]
  >,
) {
  try {
    if (
      instruction.programAddress.toString() !== COMPUTE_BUDGET_PROGRAM_ADDRESS.toString() ||
      instruction.data?.[0] !== 2 // discriminator of set compute unit limit instruction
    ) {
      throw new Error(
        `invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction`,
      );
    }
    parseSetComputeUnitLimitInstruction(
      instruction as InstructionWithData<Uint8Array<ArrayBufferLike>>,
    );
  } catch (error) {
    console.error(error);
    throw new Error(`invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction`);
  }
}

/**
 * Verify that the compute price instruction is valid.
 * This function throws an error if the compute unit price is greater than 5 lamports,
 * to protect the facilitator against gas fee abuse from the client.
 *
 * @param instruction - The compute price instruction to verify
 * @throws Error if the compute price instruction is invalid
 */
export function verifyComputePriceInstruction(
  instruction: Instruction<
    string,
    readonly (AccountLookupMeta<string, string> | AccountMeta<string>)[]
  >,
) {
  if (
    instruction.programAddress.toString() !== COMPUTE_BUDGET_PROGRAM_ADDRESS.toString() ||
    instruction.data?.[0] !== 3 // discriminator of set compute unit price instruction
  ) {
    throw new Error(`invalid_exact_svm_payload_transaction_instructions_compute_price_instruction`);
  }
  const parsedInstruction = parseSetComputeUnitPriceInstruction(
    instruction as InstructionWithData<Uint8Array<ArrayBufferLike>>,
  );

  // TODO: allow the facilitator to pass in an optional max compute unit price
  if (parsedInstruction.data.microLamports > 5 * 1_000_000) {
    throw new Error(
      `invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high`,
    );
  }
}

/**
 * Verify that the create ATA instruction is valid.
 *
 * @param instruction - The create ATA instruction to verify
 * @param paymentRequirements - The payment requirements to verify against
 * @throws Error if the create ATA instruction is invalid
 */
export function verifyCreateATAInstruction(
  instruction: Instruction<
    string,
    readonly (AccountLookupMeta<string, string> | AccountMeta<string>)[]
  >,
  paymentRequirements: PaymentRequirements,
) {
  let createATAInstruction: ReturnType<typeof parseCreateAssociatedTokenInstruction>;

  // validate and refine the type of the create ATA instruction
  try {
    assertIsInstructionWithAccounts(instruction);
    assertIsInstructionWithData(instruction);

    // parse the create ATA instruction
    createATAInstruction = parseCreateAssociatedTokenInstruction({
      ...instruction,
      data: new Uint8Array(instruction.data),
    });
  } catch (error) {
    console.error(error);
    throw new Error(`invalid_exact_svm_payload_transaction_create_ata_instruction`);
  }

  // verify that the ATA is created for the expected payee
  if (createATAInstruction.accounts.owner.address !== paymentRequirements.payTo) {
    throw new Error(`invalid_exact_svm_payload_transaction_create_ata_instruction_incorrect_payee`);
  }

  // verify that the ATA is created for the expected asset
  if (createATAInstruction.accounts.mint.address !== paymentRequirements.asset) {
    throw new Error(`invalid_exact_svm_payload_transaction_create_ata_instruction_incorrect_asset`);
  }
}

/**
 * Verify that the transfer instruction is valid.
 *
 * @param instruction - The transfer instruction to verify
 * @param paymentRequirements - The payment requirements to verify against
 * @param {object} options - The options for the verification of the transfer instruction
 * @param {boolean} options.txHasCreateDestATAInstruction - Whether the transaction has a create destination ATA instruction
 * @param signer - The signer that will sign the transaction
 * @param rpc - The RPC client to use for verifying account existence
 * @throws Error if the transfer instruction is invalid
 */
export async function verifyTransferInstruction(
  instruction: Instruction<
    string,
    readonly (AccountLookupMeta<string, string> | AccountMeta<string>)[]
  >,
  paymentRequirements: PaymentRequirements,
  { txHasCreateDestATAInstruction }: { txHasCreateDestATAInstruction: boolean },
  signer: TransactionSigner,
  rpc: RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>,
) {
  // get a validated and parsed transferChecked instruction
  const tokenInstruction = getValidatedTransferCheckedInstruction(instruction);
  await verifyTransferCheckedInstruction(
    tokenInstruction,
    paymentRequirements,
    {
      txHasCreateDestATAInstruction,
    },
    signer,
    rpc,
  );
}

/**
 * Verify that the transfer checked instruction is valid.
 *
 * @param parsedInstruction - The parsed transfer checked instruction to verify
 * @param paymentRequirements - The payment requirements to verify against
 * @param {object} options - The options for the verification of the transfer checked instruction
 * @param {boolean} options.txHasCreateDestATAInstruction - Whether the transaction has a create destination ATA instruction
 * @param signer - The signer that will sign the transaction
 * @param rpc - The RPC client to use for verifying account existence
 * @throws Error if the transfer checked instruction is invalid
 */
export async function verifyTransferCheckedInstruction(
  parsedInstruction: ReturnType<typeof parseTransferCheckedInstruction2022>,
  paymentRequirements: PaymentRequirements,
  { txHasCreateDestATAInstruction }: { txHasCreateDestATAInstruction: boolean },
  signer: TransactionSigner,
  rpc: RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>,
) {
  // get the token program address
  const tokenProgramAddress =
    parsedInstruction.programAddress.toString() === TOKEN_PROGRAM_ADDRESS.toString()
      ? TOKEN_PROGRAM_ADDRESS
      : TOKEN_2022_PROGRAM_ADDRESS;

  // verify that the fee payer is not transferring funds
  if (parsedInstruction.accounts.authority.address === signer.address) {
    throw new Error(`invalid_exact_svm_payload_transaction_fee_payer_transferring_funds`);
  }

  // get the expected receiver's ATA
  const payToATA = await findAssociatedTokenPda({
    mint: paymentRequirements.asset as Address,
    owner: paymentRequirements.payTo as Address,
    tokenProgram: tokenProgramAddress,
  });

  // verify that the transfer is to the expected ATA
  if (parsedInstruction.accounts.destination.address !== payToATA[0]) {
    throw new Error(`invalid_exact_svm_payload_transaction_transfer_to_incorrect_ata`);
  }

  // verify that the source and destination ATAs exist
  const addresses = [parsedInstruction.accounts.source.address, payToATA[0]];
  const maybeAccounts = await fetchEncodedAccounts(rpc, addresses);
  const missingAccounts = maybeAccounts.filter(a => !a.exists);
  for (const missingAccount of missingAccounts) {
    if (missingAccount.address === parsedInstruction.accounts.source.address) {
      throw new Error(`invalid_exact_svm_payload_transaction_sender_ata_not_found`);
    }
    if (missingAccount.address === payToATA[0] && !txHasCreateDestATAInstruction) {
      throw new Error(`invalid_exact_svm_payload_transaction_receiver_ata_not_found`);
    }
  }

  // verify that the amount is correct
  const instructionAmount = parsedInstruction.data.amount;
  const paymentRequirementsAmount = BigInt(paymentRequirements.maxAmountRequired);
  if (instructionAmount !== paymentRequirementsAmount) {
    throw new Error(`invalid_exact_svm_payload_transaction_amount_mismatch`);
  }
}

/**
 * Inspect the decompiled transaction message to make sure that it is a valid
 * transfer instruction.
 *
 * @param instruction - The instruction to get the transfer instruction from
 * @returns The validated transfer instruction
 * @throws Error if the instruction is not a valid transfer checked instruction
 */
export function getValidatedTransferCheckedInstruction(
  instruction: Instruction<
    string,
    readonly (AccountLookupMeta<string, string> | AccountMeta<string>)[]
  >,
) {
  try {
    assertIsInstructionWithData(instruction);
    assertIsInstructionWithAccounts(instruction);
  } catch (error) {
    console.error(error);
    throw new Error(`invalid_exact_svm_payload_transaction_instructions`);
  }

  let tokenInstruction;

  // spl-token program
  if (instruction.programAddress.toString() === TOKEN_PROGRAM_ADDRESS.toString()) {
    const identifiedInstruction = identifyTokenInstruction(instruction);
    if (identifiedInstruction !== TokenInstruction.TransferChecked) {
      throw new Error(
        `invalid_exact_svm_payload_transaction_instruction_not_spl_token_transfer_checked`,
      );
    }
    tokenInstruction = parseTransferCheckedInstructionToken({
      ...instruction,
      data: new Uint8Array(instruction.data),
    });
  }
  // token-2022 program
  else if (instruction.programAddress.toString() === TOKEN_2022_PROGRAM_ADDRESS.toString()) {
    const identifiedInstruction = identifyToken2022Instruction(instruction);
    if (identifiedInstruction !== Token2022Instruction.TransferChecked) {
      throw new Error(
        `invalid_exact_svm_payload_transaction_instruction_not_token_2022_transfer_checked`,
      );
    }
    tokenInstruction = parseTransferCheckedInstruction2022({
      ...instruction,
      data: new Uint8Array(instruction.data),
    });
  }
  // invalid instruction
  else {
    throw new Error(`invalid_exact_svm_payload_transaction_not_a_transfer_instruction`);
  }

  return tokenInstruction;
}
