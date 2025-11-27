import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, Transaction, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";

/**
 * Simplified test: Submit a review for a hypothetical job
 *
 * This test demonstrates the feedback submission flow assuming a job already exists.
 * To test with a real job, you would need to:
 * 1. Create USDC token accounts for client and agent
 * 2. Transfer USDC from client to agent
 * 3. Call register_job with the transfer instruction index
 * 4. Then call submit_feedback (what we're demonstrating here)
 */

const PROGRAM_ID = new PublicKey("5Rp6HM2R1eT6cp3aMHesEDcaXMtCJY3fmRBB1RmoSic3");

async function demonstrateFeedbackSubmission() {
  console.log("=== Review/Feedback Submission Demo ===\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet;

  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Client Wallet:", wallet.publicKey.toString());
  console.log("");

  try {
    // For demo purposes, create a hypothetical job ID
    // In reality, this would come from a registered job
    const hypotheticalPaymentTx = Keypair.generate().publicKey;
    const hypotheticalAgentWallet = Keypair.generate().publicKey;

    const [jobRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("job"), hypotheticalPaymentTx.toBuffer()],
      PROGRAM_ID
    );

    const [agentAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), hypotheticalAgentWallet.toBuffer()],
      PROGRAM_ID
    );

    const [feedbackRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("feedback"), jobRecordPda.toBuffer()],
      PROGRAM_ID
    );

    console.log("Demo Setup:");
    console.log("  Job ID (PDA):", jobRecordPda.toString());
    console.log("  Agent:", hypotheticalAgentWallet.toString());
    console.log("  Agent Account PDA:", agentAccountPda.toString());
    console.log("  Feedback Record PDA:", feedbackRecordPda.toString());
    console.log("");

    console.log("Feedback Submission Instruction Structure:");
    console.log("-------------------------------------------");
    console.log("");

    // Build submit_feedback instruction
    const rating = 5;
    const commentUri = "https://ipfs.io/ipfs/QmExample123";

    // Discriminator for "submit_feedback"
    const submitFeedbackDiscriminator = Buffer.from([
      0xf3, 0x7d, 0x5f, 0x8c, 0x8e, 0x4c, 0x8f, 0x9a
    ]);

    const ratingByte = Buffer.from([rating]);

    // comment_uri: Option<String>
    const uriBuffer = Buffer.from(commentUri, "utf-8");
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(uriBuffer.length, 0);
    const commentUriBytes = Buffer.concat([
      Buffer.from([1]), // Some(...)
      lengthBuffer,
      uriBuffer
    ]);

    const instructionData = Buffer.concat([
      submitFeedbackDiscriminator,
      ratingByte,
      commentUriBytes
    ]);

    console.log("Instruction Data:");
    console.log("  Discriminator (8 bytes):", submitFeedbackDiscriminator.toString("hex"));
    console.log("  Rating:", rating);
    console.log("  Comment URI:", commentUri);
    console.log("  Total data length:", instructionData.length, "bytes");
    console.log("");

    console.log("Required Accounts:");
    console.log("  1. feedback_record (writable, PDA):", feedbackRecordPda.toString());
    console.log("  2. job_record (readonly):", jobRecordPda.toString());
    console.log("  3. agent_account (writable, PDA):", agentAccountPda.toString());
    console.log("  4. client_wallet (signer, writable):", wallet.publicKey.toString());
    console.log("  5. system_program:", SystemProgram.programId.toString());
    console.log("");

    console.log("Complete Instruction:");
    const instruction = {
      keys: [
        { pubkey: feedbackRecordPda, isSigner: false, isWritable: true },
        { pubkey: jobRecordPda, isSigner: false, isWritable: false },
        { pubkey: agentAccountPda, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    };

    console.log(JSON.stringify({
      programId: instruction.programId.toString(),
      keys: instruction.keys.map(k => ({
        pubkey: k.pubkey.toString(),
        isSigner: k.isSigner,
        isWritable: k.isWritable
      })),
      dataLength: instruction.data.length
    }, null, 2));
    console.log("");

    console.log("Note: This is a demonstration only!");
    console.log("To actually submit feedback, you need:");
    console.log("  1. A real job ID (from register_job)");
    console.log("  2. The client wallet must match the job's client_wallet");
    console.log("  3. The agent account must exist");
    console.log("");

    console.log("For the job ID you provided:");
    console.log("  Job ID: GcR9SYoT8axDE6miLDHBEqrJEY7DYe6fhFqQRgfbBArP");
    console.log("");

    // Check if that job exists
    const providedJobId = new PublicKey("GcR9SYoT8axDE6miLDHBEqrJEY7DYe6fhFqQRgfbBArP");
    const jobAccount = await connection.getAccountInfo(providedJobId);

    if (jobAccount) {
      console.log("✓ Job exists on-chain!");
      console.log("  Owner:", jobAccount.owner.toString());
      console.log("  Data length:", jobAccount.data.length);

      if (jobAccount.owner.equals(PROGRAM_ID)) {
        console.log("");
        console.log("Parsing job record...");

        const data = jobAccount.data;
        const clientWallet = new PublicKey(data.slice(8, 40));
        const agentWallet = new PublicKey(data.slice(40, 72));
        const paymentAmount = data.readUInt32LE(72);

        console.log("  Client:", clientWallet.toString());
        console.log("  Agent:", agentWallet.toString());
        console.log("  Payment:", paymentAmount, "tokens");
        console.log("");

        // Derive actual PDAs for this job
        const [realAgentAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("agent"), agentWallet.toBuffer()],
          PROGRAM_ID
        );

        const [realFeedbackPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("feedback"), providedJobId.toBuffer()],
          PROGRAM_ID
        );

        console.log("To submit feedback for this job, use:");
        console.log("  Job ID:", providedJobId.toString());
        console.log("  Agent Account PDA:", realAgentAccountPda.toString());
        console.log("  Feedback Record PDA:", realFeedbackPda.toString());
        console.log("  Client (must be):", clientWallet.toString());

        // Check if you're the client
        if (clientWallet.equals(wallet.publicKey)) {
          console.log("");
          console.log("✓ YOU are the client for this job!");
          console.log("  You can submit feedback.");

          // Check if feedback already exists
          const existingFeedback = await connection.getAccountInfo(realFeedbackPda);
          if (existingFeedback) {
            console.log("");
            console.log("⚠️  Feedback already exists!");
            console.log("  Feedback Record:", realFeedbackPda.toString());
          } else {
            console.log("");
            console.log("✓ No feedback submitted yet. Ready to submit!");
          }
        } else {
          console.log("");
          console.log("⚠️  You are NOT the client for this job.");
          console.log("  Only the client can submit feedback.");
        }
      }
    } else {
      console.log("✗ Job does not exist on-chain (devnet)");
      console.log("  The job may need to be registered first.");
    }

    console.log("");
    console.log("Demo complete!");

  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error);
    process.exit(1);
  }
}

describe("Review Submission Demo", () => {
  it("Should demonstrate feedback submission structure", async function () {
    this.timeout(30000);
    await demonstrateFeedbackSubmission();
  });
});
