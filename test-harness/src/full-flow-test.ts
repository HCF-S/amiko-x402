import { config } from "dotenv";
import { prepare } from "./prepare.js";
import { PaymentRequirements } from "./types.js";

config();

const CROSSMINT_WALLET_ADDRESS = process.env.CROSSMINT_WALLET_ADDRESS || "";
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

async function runFullFlowTest() {
  console.log("\n=== X402 Full Flow Test (prepare + sign) ===\n");

  if (!CROSSMINT_WALLET_ADDRESS) {
    console.error("ERROR: CROSSMINT_WALLET_ADDRESS not set");
    process.exit(1);
  }

  if (!FEE_PAYER_ADDRESS) {
    console.error("ERROR: FEE_PAYER_ADDRESS not set");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  Crossmint Wallet: ${CROSSMINT_WALLET_ADDRESS}`);
  console.log(`  Fee Payer: ${FEE_PAYER_ADDRESS}`);
  console.log(`  Network: ${MOCK_PAYMENT_REQUIREMENTS.network}`);
  console.log(`  Pay To: ${MOCK_PAYMENT_REQUIREMENTS.payTo}`);
  console.log(`  Amount: ${MOCK_PAYMENT_REQUIREMENTS.maxAmountRequired}\n`);

  try {
    console.log("Step 1: Call prepare() to create unsigned transaction");
    console.log("-------------------------------------------------------");
    const unsignedTransaction = await prepare(
      CROSSMINT_WALLET_ADDRESS,
      MOCK_PAYMENT_REQUIREMENTS,
      FEE_PAYER_ADDRESS,
      SVM_DEVNET_RPC_URL,
    );
    console.log(`✓ Unsigned transaction created`);
    console.log(`  Transaction length: ${unsignedTransaction.length} bytes`);
    console.log(`  Transaction (first 64 chars): ${unsignedTransaction.substring(0, 64)}...\n`);

    console.log("=== Test Complete ===\n");
    console.log("Next steps:");
    console.log("  1. Submit this transaction to Crossmint /signatures API");
    console.log("  2. Crossmint will sign with the custodial wallet");
    console.log("  3. Submit signed transaction via settle()");
    console.log("\nThe prepare() function successfully created a valid");
    console.log("unsigned Solana transaction ready for signing!\n");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    if (error instanceof Error) {
      console.error("  Message:", error.message);
      console.error("  Stack:", error.stack);
    }
    process.exit(1);
  }
}

runFullFlowTest().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
