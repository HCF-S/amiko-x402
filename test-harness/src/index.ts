import { config } from "dotenv";
import { prepare } from "./prepare.js";
import { settle } from "./settle.js";
import { createCrossmintTransfer, createCrossmintSignature } from "./crossmint.js";
import { PaymentRequirements } from "./types.js";
import { address, type TransactionSigner, type Address } from "@solana/kit";

config();

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "";
const CROSSMINT_API_BASE_URL =
  process.env.CROSSMINT_API_BASE_URL || "https://api.crossmint.com";
const CROSSMINT_WALLET_ADDRESS = process.env.CROSSMINT_WALLET_ADDRESS || "";
const CROSSMINT_USER_ID = process.env.CROSSMINT_USER_ID || "";
const FEE_PAYER_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY || "";
const FEE_PAYER_ADDRESS = process.env.FEE_PAYER_ADDRESS || "";
const SVM_DEVNET_RPC_URL = process.env.SVM_DEVNET_RPC_URL || "";

const MOCK_PAYMENT_REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: "solana-devnet",
  maxAmountRequired: "10000",
  resource: "http://x402-server.heyamiko.com/solana-devnet/time",
  description: "",
  mimeType: "",
  outputSchema: {
    input: {
      type: "http",
      method: "GET",
      discoverable: true,
    },
  },
  payTo: "BefuCsdm8YX6VGf3T9f61xVV7is271RoA75G7fVGYV7k",
  maxTimeoutSeconds: 60,
  asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  extra: {
    feePayer: "EKQvCrdQvJEtSGfoFiHPYfr53wtpPx4SZxHUPMcQZDVr",
  },
};

async function runTest() {
  console.log("\n=== X402 Crossmint Test Harness ===\n");

  if (!CROSSMINT_API_KEY) {
    console.error("ERROR: CROSSMINT_API_KEY not set");
    process.exit(1);
  }

  if (!CROSSMINT_WALLET_ADDRESS) {
    console.error("ERROR: CROSSMINT_WALLET_ADDRESS not set");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  Crossmint Wallet: ${CROSSMINT_WALLET_ADDRESS}`);
  console.log(`  Network: ${MOCK_PAYMENT_REQUIREMENTS.network}`);
  console.log(`  Pay To: ${MOCK_PAYMENT_REQUIREMENTS.payTo}`);
  console.log(`  Amount: ${MOCK_PAYMENT_REQUIREMENTS.maxAmountRequired}`);
  console.log(`  Asset: ${MOCK_PAYMENT_REQUIREMENTS.asset}\n`);

  try {
    console.log("Step 1: Call Crossmint /transfer to submit transaction");
    console.log("-------------------------------------------------------");
    console.log("Note: Crossmint handles transaction creation and signing internally");
    console.log("      This is the recommended flow for custodial wallets\n");

    // Use userId format for wallet locator
    const walletLocator = `userId:${CROSSMINT_USER_ID}:solana`;
    console.log(`Using wallet locator: ${walletLocator}\n`);

    const transferResponse = await createCrossmintTransfer(
      {
        apiKey: CROSSMINT_API_KEY,
        baseUrl: CROSSMINT_API_BASE_URL,
        walletAddress: walletLocator,
      },
      MOCK_PAYMENT_REQUIREMENTS,
    );

    if (transferResponse.success) {
      console.log(`✓ Transfer successful!`);
      console.log(`  Transaction ID: ${transferResponse.transactionId}`);
      console.log(`  Status: ${transferResponse.status}\n`);
    } else {
      console.error(`✗ Transfer failed: ${transferResponse.error}\n`);
      process.exit(1);
    }

    console.log("=== Test Complete ===\n");
    console.log("Alternative Flow: Manual Transaction Signing");
    console.log("---------------------------------------------");
    console.log("The harness also supports manual transaction creation:");
    console.log("  1. Call prepare() with a real Solana address");
    console.log("  2. Call Crossmint /signatures to sign");
    console.log("  3. Call settle() to broadcast");
    console.log("\nThis flow requires a valid base58 Solana address,");
    console.log("not an email-based wallet locator.\n");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    if (error instanceof Error) {
      console.error("  Message:", error.message);
      console.error("  Stack:", error.stack);
    }
    process.exit(1);
  }
}

if (!FEE_PAYER_PRIVATE_KEY) {
  console.error("ERROR: SVM_PRIVATE_KEY not set - needed for fee payer");
  process.exit(1);
}

runTest().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
