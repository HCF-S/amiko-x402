import { config } from "dotenv";
import { PaymentRequirements } from "./types.js";
import { VersionedMessage, VersionedTransaction } from "@solana/web3.js";

config();

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:4000";
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "";
const CROSSMINT_API_BASE_URL = process.env.CROSSMINT_API_BASE_URL || "https://staging.crossmint.com/api";
const CROSSMINT_BASE_URL = `${CROSSMINT_API_BASE_URL}/2025-06-09`;
const CROSSMINT_WALLET_LOCATOR = process.env.CROSSMINT_WALLET_LOCATOR || "";

// Get CROSSMINT_WALLET_ADDRESS from env to use as fee payer
const CROSSMINT_WALLET_ADDRESS_FOR_FEE = process.env.CROSSMINT_WALLET_ADDRESS || "";

const MOCK_PAYMENT_REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: "solana-devnet",
  maxAmountRequired: "100000", // 0.1 USDC (or low amount in token smallest units)
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
    feePayer: CROSSMINT_WALLET_ADDRESS_FOR_FEE,
  },
};

async function runCrossmintDirectTest() {
  console.log("\n=== X402 Crossmint Direct Test (VersionedTransaction) ===\n");
  console.log("This test uses /prepare endpoint + Crossmint /transactions endpoint\n");

  if (!CROSSMINT_API_KEY) {
    console.error("ERROR: CROSSMINT_API_KEY not set");
    process.exit(1);
  }

  if (!CROSSMINT_WALLET_LOCATOR) {
    console.error("ERROR: CROSSMINT_WALLET_LOCATOR not set (format: userId:xxx:solana or sol:PUBLIC_KEY)");
    process.exit(1);
  }

  // Extract the actual wallet address for /prepare endpoint
  // The /prepare endpoint needs a real Solana public key, not the userId locator
  // So we need to use CROSSMINT_WALLET_ADDRESS from env instead
  const CROSSMINT_WALLET_ADDRESS = process.env.CROSSMINT_WALLET_ADDRESS || "";

  if (!CROSSMINT_WALLET_ADDRESS) {
    console.error("ERROR: CROSSMINT_WALLET_ADDRESS not set (needed for /prepare endpoint)");
    process.exit(1);
  }

  const walletAddressForPrepare = CROSSMINT_WALLET_ADDRESS;

  console.log("Configuration:");
  console.log(`  Facilitator: ${FACILITATOR_URL}`);
  console.log(`  Crossmint Wallet Locator: ${CROSSMINT_WALLET_LOCATOR}`);
  console.log(`  Network: ${MOCK_PAYMENT_REQUIREMENTS.network}`);
  console.log(`  Pay To: ${MOCK_PAYMENT_REQUIREMENTS.payTo}`);
  console.log(`  Amount: ${MOCK_PAYMENT_REQUIREMENTS.maxAmountRequired}\n`);

  try {
    // Step 1: Call facilitator /prepare to get unsigned transaction
    console.log("Step 1: Call facilitator /prepare");
    console.log("-----------------------------------");
    const prepareResponse = await fetch(`${FACILITATOR_URL}/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentRequirements: MOCK_PAYMENT_REQUIREMENTS,
        walletAddress: walletAddressForPrepare,
        enableTrustless: true,
      }),
    });

    if (!prepareResponse.ok) {
      const errorText = await prepareResponse.text();
      throw new Error(
        `Facilitator /prepare failed: ${prepareResponse.status} ${errorText}`,
      );
    }

    const prepareData = (await prepareResponse.json()) as {
      transaction: string;
      paymentRequirements: PaymentRequirements;
    };
    console.log(`✓ Unsigned transaction created`);
    console.log(`  Transaction (base64): '${prepareData.transaction}'...\n`);

    // Step 2: Deserialize the MESSAGE and wrap it in a VersionedTransaction
    // The /prepare endpoint returns a message (not a full transaction)
    // We need to: decode base64 -> deserialize as VersionedMessage -> wrap in VersionedTransaction
    console.log("Step 2: Deserialize message and wrap in VersionedTransaction");
    console.log("-------------------------------------------------------------");
    const messageBytes = Buffer.from(prepareData.transaction, "base64");
    const message = VersionedMessage.deserialize(messageBytes);
    const tx = new VersionedTransaction(message);
    console.log(`✓ VersionedMessage deserialized and wrapped`);
    console.log(`  Version: ${tx.version}`);
    console.log(`  Signatures (empty): ${tx.signatures.length}\n`);

    // Step 3: Serialize the VersionedTransaction for Crossmint (base58, not base64)
    // Now we have a proper VersionedTransaction with the message wrapped
    console.log("Step 3: Serialize VersionedTransaction to base58");
    console.log("-------------------------------------------------");
    const bs58 = await import("@scure/base");
    const serializedBytes = tx.serialize();
    const serialized = bs58.base58.encode(serializedBytes);
    console.log(`✓ Transaction serialized for Crossmint`);
    console.log(`  Length: ${serialized.length} characters\n`);

    // Step 4: Send to Crossmint /transactions endpoint to be signed + broadcasted
    // This endpoint handles both signing and broadcasting in one call
    console.log("Step 4: POST to Crossmint /transactions endpoint");
    console.log("-------------------------------------------------");
    const crossmintUrl = `${CROSSMINT_BASE_URL}/wallets/${encodeURIComponent(CROSSMINT_WALLET_LOCATOR)}/transactions`;
    console.log(`  URL: ${crossmintUrl}`);

    const crossmintResponse = await fetch(crossmintUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": CROSSMINT_API_KEY,
      },
      body: JSON.stringify({
        params: {
          transaction: serialized,
        },
      }),
    });

    if (!crossmintResponse.ok) {
      const errorText = await crossmintResponse.text();
      throw new Error(
        `Crossmint transaction failed: ${crossmintResponse.status} ${errorText}`,
      );
    }

    const crossmintResult = await crossmintResponse.json() as any;
    console.log(`✓ Crossmint transaction created`);
    console.log(`  Transaction ID: ${crossmintResult.id}`);
    console.log(`  Status: ${crossmintResult.status}`);
    console.log(`  Result:`, JSON.stringify(crossmintResult, null, 2));
    console.log();

    // Step 5: Poll for transaction completion
    console.log("Step 5: Poll for transaction completion");
    console.log("----------------------------------------");
    const transactionId = crossmintResult.id;
    const pollUrl = `${CROSSMINT_BASE_URL}/wallets/${encodeURIComponent(CROSSMINT_WALLET_LOCATOR)}/transactions/${transactionId}`;

    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    let finalStatus: any = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;

      console.log(`  Polling attempt ${attempts}/${maxAttempts}...`);

      const pollResponse = await fetch(pollUrl, {
        method: "GET",
        headers: {
          "X-API-KEY": CROSSMINT_API_KEY,
        },
      });

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text();
        console.error(`  ⚠️ Poll failed: ${pollResponse.status} ${errorText}`);
        break;
      }

      const status = await pollResponse.json() as any;
      console.log(`  Status: ${status.status}`);

      if (status.status === "completed" || status.status === "success") {
        finalStatus = status;
        console.log(`✓ Transaction completed!`);
        console.log(`  On-chain txId: ${status.onChain?.txId || "N/A"}`);
        if (status.onChain?.explorerLink) {
          console.log(`  Explorer: ${status.onChain.explorerLink}`);
        }
        break;
      } else if (status.status === "failed" || status.status === "error") {
        finalStatus = status;
        console.error(`✗ Transaction failed!`);
        if (status.error) {
          console.error(`  Error reason: ${status.error.reason}`);
          console.error(`  Error message: ${status.error.message}`);
        }
        break;
      }
    }

    if (!finalStatus) {
      console.log(`⚠️ Transaction still pending after ${maxAttempts} seconds`);
    }

    console.log();
    console.log("=== Test Complete ===\n");
    console.log("Successfully demonstrated:");
    console.log("  1. Called /prepare endpoint to get unsigned message (base64)");
    console.log("  2. Deserialized as VersionedMessage");
    console.log("  3. Wrapped VersionedMessage in new VersionedTransaction");
    console.log("  4. Serialized VersionedTransaction to base58");
    console.log("  5. Sent to Crossmint /transactions endpoint");
    console.log("  6. Crossmint signed and broadcasted the transaction");
    console.log("  7. Polled for transaction completion");
    if (finalStatus) {
      console.log(`  Final status: ${finalStatus.status}\n`);
    } else {
      console.log(`  Transaction still pending\n`);
    }
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    if (error instanceof Error) {
      console.error("  Message:", error.message);
      console.error("  Stack:", error.stack);
    }
    process.exit(1);
  }
}

runCrossmintDirectTest().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
