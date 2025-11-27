import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

/**
 * Test script to submit feedback/review for a job
 *
 * Job ID: GcR9SYoT8axDE6miLDHBEqrJEY7DYe6fhFqQRgfbBArP
 *
 * Smart contract function signature:
 * pub fn submit_feedback(
 *   ctx: Context<SubmitFeedback>,
 *   rating: u8,
 *   comment_uri: Option<String>,
 * ) -> Result<()>
 *
 * Required accounts:
 * - feedback_record: PDA derived from ["feedback", job_record.key()]
 * - job_record: The job being reviewed
 * - agent_account: PDA derived from ["agent", agent_wallet]
 * - client_wallet: Signer (must match job_record.client_wallet)
 * - system_program: SystemProgram
 */

// Program ID from trustless/programs/trustless/src/lib.rs (original)
const PROGRAM_ID = new PublicKey("5Rp6HM2R1eT6cp3aMHesEDcaXMtCJY3fmRBB1RmoSic3");

// Job ID to review
const JOB_ID = new PublicKey("GcR9SYoT8axDE6miLDHBEqrJEY7DYe6fhFqQRgfbBArP");

// Rating (1-5)
const RATING = 5;

// Optional comment URI
const COMMENT_URI = "https://ipfs.io/ipfs/QmExample123"; // Replace with actual IPFS URI if needed

async function main() {
  console.log("=== Submit Review/Feedback Test ===\n");

  // Set up provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet;

  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Job ID:", JOB_ID.toString());
  console.log("Client Wallet:", wallet.publicKey.toString());
  console.log("Rating:", RATING);
  console.log("Comment URI:", COMMENT_URI || "None");
  console.log("");

  try {
    // Fetch job record to get agent wallet
    console.log("Fetching job record...");
    const jobRecordAccount = await provider.connection.getAccountInfo(JOB_ID);

    if (!jobRecordAccount) {
      throw new Error("Job record not found on-chain");
    }

    console.log("✓ Job record found");
    console.log("  Account data length:", jobRecordAccount.data.length, "bytes");

    // Parse job record data
    // JobRecord structure:
    // - client_wallet: Pubkey (32 bytes)
    // - agent_wallet: Pubkey (32 bytes)
    // - payment_amount: u32 (4 bytes)
    // - created_at: i64 (8 bytes)

    const data = jobRecordAccount.data;
    const clientWallet = new PublicKey(data.slice(8, 40)); // Skip 8-byte discriminator
    const agentWallet = new PublicKey(data.slice(40, 72));
    const paymentAmountBytes = data.slice(72, 76);
    const paymentAmount = new BN(paymentAmountBytes, "le").toNumber();
    const createdAtBytes = data.slice(76, 84);
    const createdAt = new BN(createdAtBytes, "le").toString();

    console.log("Job Record Details:");
    console.log("  Client Wallet:", clientWallet.toString());
    console.log("  Agent Wallet:", agentWallet.toString());
    console.log("  Payment Amount:", paymentAmount, "tokens");
    console.log("  Created At:", new Date(Number(createdAt) * 1000).toISOString());
    console.log("");

    // Verify client wallet matches
    if (!clientWallet.equals(wallet.publicKey)) {
      throw new Error(
        `Client wallet mismatch!\n` +
        `  Expected: ${wallet.publicKey.toString()}\n` +
        `  Got: ${clientWallet.toString()}`
      );
    }

    console.log("✓ Client wallet matches");

    // Derive PDAs
    const [feedbackRecordPda, feedbackBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("feedback"), JOB_ID.toBuffer()],
      PROGRAM_ID
    );

    const [agentAccountPda, agentBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentWallet.toBuffer()],
      PROGRAM_ID
    );

    console.log("Derived Accounts:");
    console.log("  Feedback Record PDA:", feedbackRecordPda.toString());
    console.log("  Agent Account PDA:", agentAccountPda.toString());
    console.log("");

    // Check if feedback already exists
    const existingFeedback = await provider.connection.getAccountInfo(feedbackRecordPda);
    if (existingFeedback) {
      console.warn("⚠️  Feedback already exists for this job!");
      console.log("  Feedback Record:", feedbackRecordPda.toString());
      console.log("  This transaction will likely fail.");
      console.log("");
    }

    // Build instruction data manually
    // Anchor instruction format:
    // - 8 bytes: Method discriminator (first 8 bytes of SHA256("global:submit_feedback"))
    // - rating: u8 (1 byte)
    // - comment_uri: Option<String>
    //   - 1 byte: 0 = None, 1 = Some
    //   - If Some: 4 bytes length + string bytes

    const discriminator = Buffer.from([
      0xf3, 0x7d, 0x5f, 0x8c, 0x8e, 0x4c, 0x8f, 0x9a
    ]); // sha256("global:submit_feedback")[0..8]

    const ratingByte = Buffer.from([RATING]);

    let commentUriBytes: Buffer;
    if (COMMENT_URI) {
      const uriBuffer = Buffer.from(COMMENT_URI, "utf-8");
      const lengthBuffer = Buffer.alloc(4);
      lengthBuffer.writeUInt32LE(uriBuffer.length, 0);
      commentUriBytes = Buffer.concat([
        Buffer.from([1]), // Some
        lengthBuffer,
        uriBuffer
      ]);
    } else {
      commentUriBytes = Buffer.from([0]); // None
    }

    const instructionData = Buffer.concat([
      discriminator,
      ratingByte,
      commentUriBytes
    ]);

    console.log("Instruction data length:", instructionData.length, "bytes");

    // Create instruction
    const ix = {
      keys: [
        { pubkey: feedbackRecordPda, isSigner: false, isWritable: true },
        { pubkey: JOB_ID, isSigner: false, isWritable: false },
        { pubkey: agentAccountPda, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    };

    console.log("Submitting feedback transaction...");

    const tx = new anchor.web3.Transaction().add(ix);
    const signature = await provider.sendAndConfirm(tx);

    console.log("");
    console.log("✅ Feedback submitted successfully!");
    console.log("Transaction signature:", signature);
    console.log("Feedback Record:", feedbackRecordPda.toString());
    console.log("");
    console.log("View on Solana Explorer:");
    console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  } catch (error) {
    console.error("\n❌ Error submitting feedback:");
    if (error instanceof Error) {
      console.error("  Message:", error.message);
      if ("logs" in error) {
        console.error("  Program logs:", (error as any).logs);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

describe("Submit Review Test", () => {
  it("Should submit feedback for job GcR9SYoT8axDE6miLDHBEqrJEY7DYe6fhFqQRgfbBArP", async function () {
    this.timeout(60000); // Increase timeout for transaction
    await main();
  });
});
