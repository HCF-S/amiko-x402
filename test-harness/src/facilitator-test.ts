import { config } from "dotenv";
import { PaymentRequirements } from "./types.js";

config();

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:4000";
const CROSSMINT_WALLET_ADDRESS = process.env.CROSSMINT_WALLET_ADDRESS || "";

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

async function runFacilitatorTest() {
  console.log("\n=== X402 Facilitator Integration Test ===\n");
  console.log("This test uses the running facilitator server at:", FACILITATOR_URL);
  console.log("");

  if (!CROSSMINT_WALLET_ADDRESS) {
    console.error("ERROR: CROSSMINT_WALLET_ADDRESS not set");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  Facilitator: ${FACILITATOR_URL}`);
  console.log(`  Crossmint Wallet: ${CROSSMINT_WALLET_ADDRESS}`);
  console.log(`  Network: ${MOCK_PAYMENT_REQUIREMENTS.network}`);
  console.log(`  Pay To: ${MOCK_PAYMENT_REQUIREMENTS.payTo}`);
  console.log(`  Amount: ${MOCK_PAYMENT_REQUIREMENTS.maxAmountRequired}\n`);

  try {
    // Step 1: Call facilitator /prepare
    console.log("Step 1: Call facilitator /prepare");
    console.log("-----------------------------------");
    const prepareResponse = await fetch(`${FACILITATOR_URL}/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentRequirements: MOCK_PAYMENT_REQUIREMENTS,
        walletAddress: CROSSMINT_WALLET_ADDRESS,
        enableTrustless: false,
      }),
    });

    if (!prepareResponse.ok) {
      const errorText = await prepareResponse.text();
      throw new Error(`Facilitator /prepare failed: ${prepareResponse.status} ${errorText}`);
    }

    const prepareData = await prepareResponse.json() as {
      transaction: string;
      paymentRequirements: PaymentRequirements;
    };
    console.log(`✓ Unsigned transaction created`);
    console.log(`  Transaction length: ${prepareData.transaction.length} bytes\n`);

    // Step 2: Call facilitator /settle with custodial flag
    console.log("Step 2: Call facilitator /settle (custodial)");
    console.log("---------------------------------------------");
    const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {
          scheme: "exact",
          network: "solana-devnet",
          x402Version: 1,
          payload: {
            transaction: prepareData.transaction,
          },
        },
        paymentRequirements: prepareData.paymentRequirements,
        custodial: true,
        walletAddress: CROSSMINT_WALLET_ADDRESS,
      }),
    });

    if (!settleResponse.ok) {
      const errorText = await settleResponse.text();
      throw new Error(`Facilitator /settle failed: ${settleResponse.status} ${errorText}`);
    }

    const settleData = await settleResponse.json() as {
      success: boolean;
      transactionId?: string;
      status?: string;
      error?: string;
    };

    if (settleData.success) {
      console.log(`✓ Settlement successful!`);
      console.log(`  Transaction ID: ${settleData.transactionId}`);
      console.log(`  Status: ${settleData.status}\n`);
    } else {
      console.error(`✗ Settlement failed: ${settleData.error}\n`);
      process.exit(1);
    }

    console.log("=== Test Complete ===\n");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    if (error instanceof Error) {
      console.error("  Message:", error.message);
    }
    process.exit(1);
  }
}

runFacilitatorTest().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
