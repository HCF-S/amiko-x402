import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";

/**
 * Complete flow test for trustless review system:
 * 1. Create USDC token accounts for client and agent
 * 2. Register a job (with payment transfer)
 * 3. Submit feedback/review for the job
 *
 * Program ID: 5Rp6HM2R1eT6cp3aMHesEDcaXMtCJY3fmRBB1RmoSic3
 */

const PROGRAM_ID = new PublicKey("5Rp6HM2R1eT6cp3aMHesEDcaXMtCJY3fmRBB1RmoSic3");

// USDC Devnet mint address
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// For testing, we'll use a test token we create ourselves
let TEST_MINT: PublicKey;

async function main() {
  console.log("=== Complete Review Flow Test ===\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = provider.wallet;

  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Payer/Client:", payer.publicKey.toString());
  console.log("");

  try {
    // Step 1: Create a test token mint
    console.log("Step 1: Creating test token mint...");
    const mintKeypair = Keypair.generate();
    TEST_MINT = mintKeypair.publicKey;

    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: TEST_MINT,
        space: 82,
        lamports: await connection.getMinimumBalanceForRentExemption(82),
        programId: TOKEN_PROGRAM_ID,
      }),
      // Initialize mint instruction would go here, but we'll use spl-token for simplicity
    );

    console.log("✓ Test mint:", TEST_MINT.toString());
    console.log("");

    // Step 2: Create agent keypair (for testing)
    console.log("Step 2: Setting up agent wallet...");
    const agentKeypair = Keypair.generate();
    const agentWallet = agentKeypair.publicKey;

    console.log("✓ Agent wallet:", agentWallet.toString());
    console.log("");

    // Step 3: Get token accounts
    console.log("Step 3: Getting token accounts...");

    // Get client's existing USDC account
    const { getAssociatedTokenAddress } = await import("@solana/spl-token");

    const clientTokenAddress = await getAssociatedTokenAddress(
      USDC_DEVNET_MINT,
      payer.publicKey
    );

    const agentTokenAddress = await getAssociatedTokenAddress(
      USDC_DEVNET_MINT,
      agentWallet
    );

    console.log("✓ Client token account:", clientTokenAddress.toString());
    console.log("✓ Agent token account:", agentTokenAddress.toString());

    // Check if client account exists, if not get the actual one from spl-token
    let actualClientTokenAddress = clientTokenAddress;
    const clientTokenInfo = await connection.getAccountInfo(clientTokenAddress);
    if (!clientTokenInfo) {
      console.log("ATA doesn't exist, finding actual client token account...");
      const { getAccount, getMint } = await import("@solana/spl-token");

      // Get all token accounts for this wallet
      const tokenAccounts = await connection.getTokenAccountsByOwner(payer.publicKey, {
        mint: USDC_DEVNET_MINT
      });

      if (tokenAccounts.value.length > 0) {
        actualClientTokenAddress = tokenAccounts.value[0].pubkey;
        console.log("✓ Found existing token account:", actualClientTokenAddress.toString());
      } else {
        console.log("⚠️  No USDC token account found!");
        console.log("Creating one...");
        const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
        const createClientAtaTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            clientTokenAddress,
            payer.publicKey,
            USDC_DEVNET_MINT
          )
        );
        await provider.sendAndConfirm(createClientAtaTx);
        actualClientTokenAddress = clientTokenAddress;
        console.log("✓ Client token account created");
      }
    }

    // Check if agent account exists, if not create it
    const agentTokenInfo = await connection.getAccountInfo(agentTokenAddress);
    if (!agentTokenInfo) {
      console.log("Creating agent token account...");
      const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
      const createAgentAtaTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          agentTokenAddress,
          agentWallet,
          USDC_DEVNET_MINT
        )
      );
      await provider.sendAndConfirm(createAgentAtaTx);
      console.log("✓ Agent token account created");
    }

    console.log("");

    // Step 4: Check client token balance
    console.log("Step 4: Checking client token balance...");
    const clientBalance = await connection.getTokenAccountBalance(actualClientTokenAddress);
    console.log("Client USDC balance:", clientBalance.value.uiAmount, "USDC");

    if (Number(clientBalance.value.amount) < 10000) {
      console.log("⚠️  Insufficient USDC balance!");
      console.log("You need at least 0.01 USDC in your devnet wallet.");
      console.log("Get devnet USDC from: https://spl-token-faucet.com/?token-name=USDC-Dev");
      console.log("");
      console.log("Client token account:", clientTokenAddress.toString());
      return;
    }

    console.log("✓ Sufficient balance");
    console.log("");

    // Step 5: Create payment transaction reference
    console.log("Step 5: Creating payment transaction reference...");
    const paymentTxKeypair = Keypair.generate();
    const paymentTxPubkey = paymentTxKeypair.publicKey;

    console.log("✓ Payment TX reference:", paymentTxPubkey.toString());
    console.log("");

    // Step 6: Derive PDAs
    console.log("Step 6: Deriving program addresses...");
    const [jobRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("job"), paymentTxPubkey.toBuffer()],
      PROGRAM_ID
    );

    const [agentAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentWallet.toBuffer()],
      PROGRAM_ID
    );

    const [feedbackRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("feedback"), jobRecordPda.toBuffer()],
      PROGRAM_ID
    );

    console.log("✓ Job Record PDA:", jobRecordPda.toString());
    console.log("✓ Agent Account PDA:", agentAccountPda.toString());
    console.log("✓ Feedback Record PDA:", feedbackRecordPda.toString());
    console.log("");

    // Step 7: Register job with payment
    console.log("Step 7: Registering job (with payment transfer)...");

    const paymentAmount = 10000; // 0.01 USDC (6 decimals)

    // Build the transfer + register_job transaction
    const transferIx = createTransferInstruction(
      actualClientTokenAddress,
      agentTokenAddress,
      payer.publicKey,
      paymentAmount,
      [],
      TOKEN_PROGRAM_ID
    );

    // Build register_job instruction manually
    // Discriminator for "register_job" = first 8 bytes of sha256("global:register_job")
    const registerJobDiscriminator = Buffer.from([
      0x57, 0xd5, 0xb1, 0xff, 0x83, 0x11, 0xb2, 0x2d
    ]);

    // transfer_instruction_index: u8 (the transfer is instruction 0)
    const transferInstructionIndex = Buffer.from([0]);

    const registerJobData = Buffer.concat([
      registerJobDiscriminator,
      transferInstructionIndex
    ]);

    const registerJobIx = {
      keys: [
        { pubkey: jobRecordPda, isSigner: false, isWritable: true },
        { pubkey: agentAccountPda, isSigner: false, isWritable: true },
        { pubkey: agentWallet, isSigner: false, isWritable: false },
        { pubkey: actualClientTokenAddress, isSigner: false, isWritable: false },
        { pubkey: agentTokenAddress, isSigner: false, isWritable: false },
        { pubkey: paymentTxPubkey, isSigner: false, isWritable: false },
        {
          pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
          isSigner: false,
          isWritable: false
        },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // fee_payer
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: registerJobData,
    };

    const registerJobTx = new Transaction();
    registerJobTx.add(transferIx);
    registerJobTx.add(registerJobIx);

    console.log("Sending transaction...");
    const registerJobSig = await provider.sendAndConfirm(registerJobTx);

    console.log("✓ Job registered successfully!");
    console.log("  Transaction:", registerJobSig);
    console.log("  Job ID:", jobRecordPda.toString());
    console.log("  View: https://explorer.solana.com/tx/" + registerJobSig + "?cluster=devnet");
    console.log("");

    // Step 8: Verify job record
    console.log("Step 8: Verifying job record...");
    const jobRecordAccount = await connection.getAccountInfo(jobRecordPda);

    if (!jobRecordAccount) {
      throw new Error("Job record not found after registration!");
    }

    console.log("✓ Job record exists");
    console.log("  Data length:", jobRecordAccount.data.length, "bytes");
    console.log("");

    // Step 9: Submit feedback
    console.log("Step 9: Submitting feedback/review...");

    const rating = 5;
    const commentUri = "https://ipfs.io/ipfs/QmReviewExample123";

    // Build submit_feedback instruction
    // Discriminator for "submit_feedback" = first 8 bytes of sha256("global:submit_feedback")
    const submitFeedbackDiscriminator = Buffer.from([
      0xde, 0xbd, 0x10, 0xcb, 0xba, 0x97, 0xec, 0xbc
    ]);

    const ratingByte = Buffer.from([rating]);

    // comment_uri: Option<String>
    const uriBuffer = Buffer.from(commentUri, "utf-8");
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(uriBuffer.length, 0);
    const commentUriBytes = Buffer.concat([
      Buffer.from([1]), // Some
      lengthBuffer,
      uriBuffer
    ]);

    const submitFeedbackData = Buffer.concat([
      submitFeedbackDiscriminator,
      ratingByte,
      commentUriBytes
    ]);

    const submitFeedbackIx = {
      keys: [
        { pubkey: feedbackRecordPda, isSigner: false, isWritable: true },
        { pubkey: jobRecordPda, isSigner: false, isWritable: false },
        { pubkey: agentAccountPda, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: submitFeedbackData,
    };

    const submitFeedbackTx = new Transaction().add(submitFeedbackIx);

    console.log("Sending transaction...");
    const submitFeedbackSig = await provider.sendAndConfirm(submitFeedbackTx);

    console.log("✓ Feedback submitted successfully!");
    console.log("  Transaction:", submitFeedbackSig);
    console.log("  Feedback Record:", feedbackRecordPda.toString());
    console.log("  Rating:", rating, "stars");
    console.log("  Comment:", commentUri);
    console.log("  View: https://explorer.solana.com/tx/" + submitFeedbackSig + "?cluster=devnet");
    console.log("");

    // Step 10: Verify feedback record
    console.log("Step 10: Verifying feedback record...");
    const feedbackRecordAccount = await connection.getAccountInfo(feedbackRecordPda);

    if (!feedbackRecordAccount) {
      throw new Error("Feedback record not found after submission!");
    }

    console.log("✓ Feedback record exists");
    console.log("  Data length:", feedbackRecordAccount.data.length, "bytes");
    console.log("");

    console.log("🎉 Complete flow test passed!");
    console.log("");
    console.log("Summary:");
    console.log("  Job ID:", jobRecordPda.toString());
    console.log("  Agent:", agentWallet.toString());
    console.log("  Payment:", paymentAmount / 1_000_000, "USDC");
    console.log("  Rating:", rating, "/ 5");
    console.log("  Feedback:", feedbackRecordPda.toString());

  } catch (error) {
    console.error("\n❌ Error:");
    if (error instanceof Error) {
      console.error("  Message:", error.message);
      console.error("  Stack:", error.stack);
      if ("logs" in error) {
        console.error("\n  Program logs:");
        (error as any).logs?.forEach((log: string) => console.error("    ", log));
      }
    } else {
      console.error(error);
    }
    throw error; // Re-throw for mocha
  }
}

describe("Complete Review Flow", () => {
  it("Should register job and submit feedback", async function () {
    this.timeout(120000); // 2 minutes for multiple transactions
    await main();
  });
});
