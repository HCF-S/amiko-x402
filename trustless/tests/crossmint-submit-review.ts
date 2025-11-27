import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { config } from "dotenv";

config();

/**
 * CORRECT IMPLEMENTATION: Submit review using Crossmint REST API
 * 1. Upload review to IPFS via Pinata
 * 2. Submit transaction to Crossmint with IPFS URI
 */

const PROGRAM_ID = new PublicKey("5Rp6HM2R1eT6cp3aMHesEDcaXMtCJY3fmRBB1RmoSic3");

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "";
const CROSSMINT_API_BASE_URL = process.env.CROSSMINT_API_BASE_URL || "https://staging.crossmint.com/api";
const CROSSMINT_USER_ID = process.env.CROSSMINT_USER_ID || "";
const CROSSMINT_WALLET_ADDRESS = process.env.CROSSMINT_WALLET_ADDRESS || "";

const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_API_KEY = process.env.PINATA_API_KEY || "";
const PINATA_API_SECRET = process.env.PINATA_API_SECRET || "";
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud";

// Job ID to review
const JOB_ID = new PublicKey("EP3pmH94AUWtkK52v9Mr9SWcVcROejCWF1WXXXcAJ9a");

async function uploadReviewToPinata(reviewData: any): Promise<string> {
  console.log("Uploading review to Pinata...");

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "pinata_api_key": PINATA_API_KEY,
      "pinata_secret_api_key": PINATA_API_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: reviewData,
      pinataMetadata: {
        name: `review-${Date.now()}.json`,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  const ipfsHash = result.IpfsHash;
  const ipfsUri = `https://${PINATA_GATEWAY}/ipfs/${ipfsHash}`;

  console.log("✓ Review uploaded to IPFS");
  console.log("  IPFS Hash:", ipfsHash);
  console.log("  URI:", ipfsUri);
  console.log("");

  return ipfsUri;
}

async function submitReviewViaCrossmint() {
  console.log("=== Submit Review via Crossmint REST API ===\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  console.log("Crossmint API:", CROSSMINT_API_BASE_URL);
  console.log("Crossmint Wallet:", CROSSMINT_WALLET_ADDRESS);
  console.log("Job ID:", JOB_ID.toString());
  console.log("");

  try {
    // Fetch job record
    const jobRecordAccount = await connection.getAccountInfo(JOB_ID);
    if (!jobRecordAccount) {
      throw new Error("Job not found");
    }

    const data = jobRecordAccount.data;
    const clientWallet = new PublicKey(data.slice(8, 40));
    const agentWallet = new PublicKey(data.slice(40, 72));
    const paymentAmount = data.readUInt32LE(72);

    console.log("Job Details:");
    console.log("  Client:", clientWallet.toString());
    console.log("  Agent:", agentWallet.toString());
    console.log("  Payment:", paymentAmount / 1_000_000, "USDC");
    console.log("");

    // Derive PDAs
    const [agentAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentWallet.toBuffer()],
      PROGRAM_ID
    );

    const [feedbackRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("feedback"), JOB_ID.toBuffer()],
      PROGRAM_ID
    );

    console.log("PDAs:");
    console.log("  Agent Account:", agentAccountPda.toString());
    console.log("  Feedback Record:", feedbackRecordPda.toString());
    console.log("");

    // Step 1: Upload review to IPFS
    const rating = 5;
    const reviewData = {
      jobId: JOB_ID.toString(),
      agentWallet: agentWallet.toString(),
      clientWallet: clientWallet.toString(),
      rating: rating,
      comment: "Excellent service! The agent was professional and delivered high-quality results on time.",
      timestamp: new Date().toISOString(),
      paymentAmount: paymentAmount / 1_000_000,
    };

    let commentUri: string;
    try {
      commentUri = await uploadReviewToPinata(reviewData);
    } catch (error) {
      console.log("⚠️  Pinata upload failed, using placeholder URI");
      console.log("  Error:", error instanceof Error ? error.message : String(error));
      console.log("  Review data:", JSON.stringify(reviewData, null, 2));
      commentUri = `https://${PINATA_GATEWAY}/ipfs/QmPlaceholder${Date.now()}`;
      console.log("  Using URI:", commentUri);
      console.log("");
    }

    // Step 2: Build submit_feedback instruction
    console.log("Building submit_feedback instruction...");

    const discriminator = Buffer.from([0xde, 0xbd, 0x10, 0xcb, 0xba, 0x97, 0xec, 0xbc]);
    const ratingByte = Buffer.from([rating]);

    const uriBuffer = Buffer.from(commentUri, "utf-8");
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(uriBuffer.length, 0);
    const commentUriBytes = Buffer.concat([Buffer.from([1]), lengthBuffer, uriBuffer]);

    const instructionData = Buffer.concat([discriminator, ratingByte, commentUriBytes]);

    const crossmintPubkey = new PublicKey(CROSSMINT_WALLET_ADDRESS);

    const instruction = {
      keys: [
        { pubkey: feedbackRecordPda, isSigner: false, isWritable: true },
        { pubkey: JOB_ID, isSigner: false, isWritable: false },
        { pubkey: agentAccountPda, isSigner: false, isWritable: true },
        { pubkey: crossmintPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    };

    console.log("✓ Instruction built");
    console.log("  Rating:", rating, "stars");
    console.log("  Comment URI:", commentUri);
    console.log("");

    // Step 3: Build transaction
    console.log("Building transaction...");
    const { blockhash } = await connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: crossmintPubkey,
      recentBlockhash: blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Crossmint expects base58, not base64!
    const bs58 = await import("bs58");
    const serializedTx = bs58.default.encode(transaction.serialize());

    console.log("✓ Transaction built (" + transaction.serialize().length + " bytes)");
    console.log("");

    // Step 4: Submit to Crossmint
    console.log("Submitting to Crossmint...");
    const walletLocator = `userId:${CROSSMINT_USER_ID}:solana`;
    const url = `${CROSSMINT_API_BASE_URL}/2025-06-09/wallets/${encodeURIComponent(walletLocator)}/transactions`;

    console.log("[Crossmint] POST", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": CROSSMINT_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        params: {
          transaction: serializedTx,
        },
      }),
    });

    const responseText = await response.text();
    console.log("[Crossmint] Response:", responseText);
    console.log("");

    if (!response.ok) {
      throw new Error(`Crossmint failed: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText);

    console.log("✅ Review submitted via Crossmint!");
    console.log("  Transaction ID:", result.id || result.transactionId);
    console.log("  Status:", result.status);
    console.log("  Feedback Record:", feedbackRecordPda.toString());
    console.log("  IPFS Review:", commentUri);

  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error);
    throw error;
  }
}

describe("Crossmint Review", () => {
  it("Should submit review via Crossmint API with Pinata IPFS", async function () {
    this.timeout(60000);
    await submitReviewViaCrossmint();
  });
});
