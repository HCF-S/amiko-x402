import { config } from "dotenv";
import { Connection, PublicKey, VersionedMessage, VersionedTransaction, TransactionMessage, SystemProgram } from "@solana/web3.js";
import { base58 } from "@scure/base";
import {
  getCompiledTransactionMessageDecoder,
  getTransactionEncoder,
  getTransactionDecoder,
  type Transaction,
} from "@solana/kit";

config();

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:4000";
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "";
const CROSSMINT_API_BASE_URL = process.env.CROSSMINT_API_BASE_URL || "https://staging.crossmint.com/api";
const CROSSMINT_BASE_URL = `${CROSSMINT_API_BASE_URL}/2025-06-09`;
const CROSSMINT_WALLET_LOCATOR = process.env.CROSSMINT_WALLET_LOCATOR || "";
const CROSSMINT_WALLET_ADDRESS = process.env.CROSSMINT_WALLET_ADDRESS || "";
const SVM_DEVNET_RPC_URL = process.env.SVM_DEVNET_RPC_URL || "https://api.devnet.solana.com";

// Agent wallet to pay to (for x402 tests)
const AGENT_WALLET = "BefuCsdm8YX6VGf3T9f61xVV7is271RoA75G7fVGYV7k";
// USDC on devnet
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
// Token program addresses
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/**
 * Submit a transaction to Crossmint and poll for completion
 */
async function submitToCrossmint(serializedTx: string): Promise<any> {
  console.log("\n[Crossmint] Submitting transaction...");
  const url = `${CROSSMINT_BASE_URL}/wallets/${encodeURIComponent(CROSSMINT_WALLET_LOCATOR)}/transactions`;
  console.log(`[Crossmint] POST ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": CROSSMINT_API_KEY,
    },
    body: JSON.stringify({
      params: {
        transaction: serializedTx,
      },
    }),
  });

  const responseText = await response.text();
  console.log(`[Crossmint] Response (${response.status}): ${responseText}`);

  if (!response.ok) {
    throw new Error(`Crossmint failed: ${response.status} ${responseText}`);
  }

  const result = JSON.parse(responseText);
  console.log(`[Crossmint] Transaction ID: ${result.id}`);
  console.log(`[Crossmint] Status: ${result.status}`);

  // Poll for completion
  return await pollTransaction(result.id);
}

/**
 * Poll Crossmint for transaction completion
 */
async function pollTransaction(transactionId: string): Promise<any> {
  console.log("\n[Crossmint] Polling for completion...");
  const pollUrl = `${CROSSMINT_BASE_URL}/wallets/${encodeURIComponent(CROSSMINT_WALLET_LOCATOR)}/transactions/${transactionId}`;

  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;

    const pollResponse = await fetch(pollUrl, {
      method: "GET",
      headers: { "X-API-KEY": CROSSMINT_API_KEY },
    });

    if (!pollResponse.ok) {
      console.log(`[Crossmint] Poll failed: ${pollResponse.status}`);
      continue;
    }

    const status = await pollResponse.json() as any;
    console.log(`[Crossmint] Poll ${attempts}/${maxAttempts}: ${status.status}`);

    if (status.status === "completed" || status.status === "success") {
      console.log(`\n✅ Transaction completed!`);
      console.log(`   On-chain txId: ${status.onChain?.txId || "N/A"}`);
      if (status.onChain?.explorerLink) {
        console.log(`   Explorer: ${status.onChain.explorerLink}`);
      }
      return status;
    } else if (status.status === "failed" || status.status === "error") {
      console.log(`\n❌ Transaction failed!`);
      console.log(`   Error: ${JSON.stringify(status.error || status, null, 2)}`);
      return status;
    }
  }

  console.log(`\n⚠️ Transaction still pending after ${maxAttempts * 2} seconds`);
  return null;
}

/**
 * Test 1: Simple SOL transfer (no tokens, no trustless)
 * This is the simplest possible transaction to verify Crossmint integration works
 */
async function testSimpleTransfer() {
  console.log("\n=== Test: Simple SOL Transfer ===\n");

  const connection = new Connection(SVM_DEVNET_RPC_URL);
  const fromPubkey = new PublicKey(CROSSMINT_WALLET_ADDRESS);
  const toPubkey = new PublicKey(AGENT_WALLET);

  console.log(`From: ${fromPubkey.toString()}`);
  console.log(`To: ${toPubkey.toString()}`);
  console.log(`Amount: 0.001 SOL (1,000,000 lamports)`);

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  console.log(`Blockhash: ${blockhash}`);

  // Create simple transfer instruction
  const instruction = SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: 1_000_000, // 0.001 SOL
  });

  // Build transaction message
  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);

  // Serialize to base58 for Crossmint
  const serialized = base58.encode(transaction.serialize());
  console.log(`\nTransaction serialized (${serialized.length} chars)`);

  // Submit to Crossmint
  return await submitToCrossmint(serialized);
}

/**
 * Test 2: Transaction from /prepare endpoint (non-trustless USDC transfer)
 */
async function testPrepareSimple() {
  console.log("\n=== Test: /prepare Simple (non-trustless) ===\n");

  const paymentRequirements = {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "10000", // 0.01 USDC
    resource: "http://test.local/resource",
    description: "Test payment",
    mimeType: "",
    payTo: AGENT_WALLET,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
    extra: {
      feePayer: CROSSMINT_WALLET_ADDRESS,
    },
  };

  console.log("Payment Requirements:");
  console.log(`  Pay To: ${paymentRequirements.payTo}`);
  console.log(`  Amount: ${paymentRequirements.maxAmountRequired} (smallest units)`);
  console.log(`  Asset: ${paymentRequirements.asset}`);
  console.log(`  Fee Payer: ${paymentRequirements.extra.feePayer}`);

  // Call /prepare
  console.log(`\nCalling ${FACILITATOR_URL}/prepare...`);
  const response = await fetch(`${FACILITATOR_URL}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentRequirements,
      walletAddress: CROSSMINT_WALLET_ADDRESS,
      enableTrustless: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`/prepare failed: ${response.status} ${errorText}`);
  }

  const prepareData = await response.json() as any;
  console.log(`✓ Got unsigned transaction from /prepare`);
  console.log(`  Raw transaction (base64): ${prepareData.transaction.substring(0, 50)}...`);
  console.log(`  Base64 length: ${prepareData.transaction.length}`);

  // Decode from base64 to bytes
  const transactionBytes = Uint8Array.from(atob(prepareData.transaction), c => c.charCodeAt(0));
  console.log(`  Decoded bytes length: ${transactionBytes.length}`);
  console.log(`  First 4 bytes: ${Array.from(transactionBytes.slice(0, 4))}`);

  // Try to decode as a full transaction first (data starts with signature count)
  let transaction: Transaction;
  try {
    const txDecoder = getTransactionDecoder();
    transaction = txDecoder.decode(transactionBytes);
    console.log(`  Decoded as full transaction`);
    console.log(`  Signatures: ${Object.keys(transaction.signatures).length}`);
  } catch (e) {
    // Fall back to decoding as compiled message
    console.log(`  Decoding as compiled message...`);
    const decoder = getCompiledTransactionMessageDecoder();
    const compiledMessage = decoder.decode(transactionBytes);
    console.log(`  Static accounts: ${compiledMessage.staticAccounts.length}`);
    console.log(`  Instructions: ${compiledMessage.instructions.length}`);
    console.log(`  Signatures required: ${compiledMessage.header.numSignerAccounts}`);

    // Create a Transaction object with the message bytes and empty signatures
    transaction = {
      messageBytes: transactionBytes as Transaction["messageBytes"],
      signatures: {},
    };
  }

  // Encode the full transaction for Crossmint (base58)
  const txEncoder = getTransactionEncoder();
  const encodedTx = txEncoder.encode(transaction);
  const serialized = base58.encode(encodedTx);
  console.log(`Transaction serialized (${serialized.length} chars)`);

  // Submit to Crossmint
  return await submitToCrossmint(serialized);
}

/**
 * Test 3: Transaction from /prepare endpoint with trustless enabled
 */
async function testPrepareTrustless() {
  console.log("\n=== Test: /prepare Trustless ===\n");

  const paymentRequirements = {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "10000", // 0.01 USDC
    resource: "http://test.local/resource",
    description: "Test trustless payment",
    mimeType: "",
    payTo: AGENT_WALLET,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
    extra: {
      feePayer: CROSSMINT_WALLET_ADDRESS,
    },
  };

  console.log("Payment Requirements:");
  console.log(`  Pay To: ${paymentRequirements.payTo}`);
  console.log(`  Amount: ${paymentRequirements.maxAmountRequired} (smallest units)`);
  console.log(`  Asset: ${paymentRequirements.asset}`);
  console.log(`  Fee Payer: ${paymentRequirements.extra.feePayer}`);
  console.log(`  Trustless: ENABLED`);

  // Call /prepare with trustless enabled
  console.log(`\nCalling ${FACILITATOR_URL}/prepare...`);
  const response = await fetch(`${FACILITATOR_URL}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentRequirements,
      walletAddress: CROSSMINT_WALLET_ADDRESS,
      enableTrustless: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`/prepare failed: ${response.status} ${errorText}`);
  }

  const prepareData = await response.json() as any;
  console.log(`✓ Got unsigned transaction from /prepare`);
  console.log(`  Raw transaction (base64): ${prepareData.transaction.substring(0, 50)}...`);
  console.log(`  Base64 length: ${prepareData.transaction.length}`);

  // Decode from base64 to bytes
  const transactionBytes = Uint8Array.from(atob(prepareData.transaction), c => c.charCodeAt(0));
  console.log(`  Decoded bytes length: ${transactionBytes.length}`);
  console.log(`  First 4 bytes: ${Array.from(transactionBytes.slice(0, 4))}`);

  // Try to decode as a full transaction first (data starts with signature count)
  let transaction: Transaction;
  try {
    const txDecoder = getTransactionDecoder();
    transaction = txDecoder.decode(transactionBytes);
    console.log(`  Decoded as full transaction`);
    console.log(`  Signatures: ${Object.keys(transaction.signatures).length}`);
  } catch (e) {
    // Fall back to decoding as compiled message
    console.log(`  Decoding as compiled message...`);
    const decoder = getCompiledTransactionMessageDecoder();
    const compiledMessage = decoder.decode(transactionBytes);
    console.log(`  Static accounts: ${compiledMessage.staticAccounts.length}`);
    console.log(`  Instructions: ${compiledMessage.instructions.length}`);
    console.log(`  Signatures required: ${compiledMessage.header.numSignerAccounts}`);

    // Create a Transaction object with the message bytes and empty signatures
    transaction = {
      messageBytes: transactionBytes as Transaction["messageBytes"],
      signatures: {},
    };
  }

  // Encode the full transaction for Crossmint (base58)
  const txEncoder = getTransactionEncoder();
  const encodedTx = txEncoder.encode(transaction);
  const serialized = base58.encode(encodedTx);
  console.log(`Transaction serialized (${serialized.length} chars)`);

  // Submit to Crossmint
  return await submitToCrossmint(serialized);
}

/**
 * Test 4: Full flow using /prepare → /settle (non-trustless)
 * This is the correct way to use x402 with Crossmint wallets
 */
async function testFullFlow() {
  console.log("\n=== Test: Full Flow (/prepare → /settle) ===\n");

  const paymentRequirements = {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "10000", // 0.01 USDC
    resource: "http://test.local/resource",
    description: "Test payment via full flow",
    mimeType: "",
    payTo: AGENT_WALLET,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
    extra: {},
  };

  console.log("Payment Requirements:");
  console.log(`  Pay To: ${paymentRequirements.payTo}`);
  console.log(`  Amount: ${paymentRequirements.maxAmountRequired} (smallest units)`);
  console.log(`  Asset: ${paymentRequirements.asset}`);

  // Step 1: Call /prepare
  console.log(`\n[Step 1] Calling ${FACILITATOR_URL}/prepare...`);
  const prepareResponse = await fetch(`${FACILITATOR_URL}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentRequirements,
      walletAddress: CROSSMINT_WALLET_ADDRESS,
      enableTrustless: false,
    }),
  });

  if (!prepareResponse.ok) {
    const errorText = await prepareResponse.text();
    throw new Error(`/prepare failed: ${prepareResponse.status} ${errorText}`);
  }

  const prepareData = await prepareResponse.json() as any;
  console.log(`✓ Got unsigned transaction from /prepare`);
  console.log(`  Fee Payer: ${prepareData.paymentRequirements?.extra?.feePayer}`);

  // Step 2: Create payment payload
  const paymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "solana-devnet",
    payload: {
      signature: "", // Not used for Crossmint flow
      transaction: prepareData.transaction,
    },
  };

  // Step 3: Call /settle (this handles Crossmint signing + submission)
  console.log(`\n[Step 2] Calling ${FACILITATOR_URL}/settle...`);
  const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirements: prepareData.paymentRequirements,
      enableTrustless: false,
    }),
  });

  if (!settleResponse.ok) {
    const errorText = await settleResponse.text();
    throw new Error(`/settle failed: ${settleResponse.status} ${errorText}`);
  }

  const settleResult = await settleResponse.json() as any;
  console.log(`\n✓ Settle result:`);
  console.log(`  Success: ${settleResult.success}`);
  console.log(`  Transaction: ${settleResult.transaction}`);
  console.log(`  Network: ${settleResult.network}`);
  if (settleResult.payer) {
    console.log(`  Payer: ${settleResult.payer}`);
  }
  if (settleResult.errorReason) {
    console.log(`  Error: ${settleResult.errorReason}`);
  }

  return settleResult;
}

/**
 * Test 5: Full flow with trustless enabled
 * This tests the complete trustless flow: /prepare → /settle with job registration
 */
async function testFullFlowTrustless() {
  console.log("\n=== Test: Full Flow Trustless (/prepare → /settle) ===\n");

  const paymentRequirements = {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "10000", // 0.01 USDC
    resource: "http://test.local/resource",
    description: "Test trustless payment via full flow",
    mimeType: "",
    payTo: AGENT_WALLET,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
    extra: {},
  };

  console.log("Payment Requirements:");
  console.log(`  Pay To: ${paymentRequirements.payTo}`);
  console.log(`  Amount: ${paymentRequirements.maxAmountRequired} (smallest units)`);
  console.log(`  Asset: ${paymentRequirements.asset}`);
  console.log(`  Trustless: ENABLED`);

  // Step 1: Call /prepare with trustless
  console.log(`\n[Step 1] Calling ${FACILITATOR_URL}/prepare with trustless...`);
  const prepareResponse = await fetch(`${FACILITATOR_URL}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentRequirements,
      walletAddress: CROSSMINT_WALLET_ADDRESS,
      enableTrustless: true,
    }),
  });

  if (!prepareResponse.ok) {
    const errorText = await prepareResponse.text();
    throw new Error(`/prepare failed: ${prepareResponse.status} ${errorText}`);
  }

  const prepareData = await prepareResponse.json() as any;
  console.log(`✓ Got unsigned transaction from /prepare`);
  console.log(`  Fee Payer: ${prepareData.paymentRequirements?.extra?.feePayer}`);

  // Step 2: Create payment payload
  const paymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "solana-devnet",
    payload: {
      signature: "", // Not used for Crossmint flow
      transaction: prepareData.transaction,
    },
  };

  // Step 3: Call /settle with trustless (this handles signing + submission + job registration)
  console.log(`\n[Step 2] Calling ${FACILITATOR_URL}/settle with trustless...`);
  const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirements: prepareData.paymentRequirements,
      enableTrustless: true,
    }),
  });

  if (!settleResponse.ok) {
    const errorText = await settleResponse.text();
    throw new Error(`/settle failed: ${settleResponse.status} ${errorText}`);
  }

  const settleResult = await settleResponse.json() as any;
  console.log(`\n✓ Settle result:`);
  console.log(`  Success: ${settleResult.success}`);
  console.log(`  Transaction: ${settleResult.transaction}`);
  console.log(`  Network: ${settleResult.network}`);
  if (settleResult.payer) {
    console.log(`  Payer: ${settleResult.payer}`);
  }
  if (settleResult.jobId) {
    console.log(`  Job ID: ${settleResult.jobId}`);
  }
  if (settleResult.errorReason) {
    console.log(`  Error: ${settleResult.errorReason}`);
  }

  return settleResult;
}

/**
 * Test 6: Show /prepare transaction info without submitting
 */
async function testPrepareInfo() {
  console.log("\n=== Test: /prepare Info (no submit) ===\n");

  const paymentRequirements = {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "10000", // 0.01 USDC
    resource: "http://test.local/resource",
    description: "Test payment",
    mimeType: "",
    payTo: AGENT_WALLET,
    maxTimeoutSeconds: 60,
    asset: USDC_MINT,
    extra: {},
  };

  console.log("Payment Requirements:");
  console.log(`  Pay To: ${paymentRequirements.payTo}`);
  console.log(`  Amount: ${paymentRequirements.maxAmountRequired} (smallest units)`);
  console.log(`  Asset: ${paymentRequirements.asset}`);

  // Call /prepare
  console.log(`\nCalling ${FACILITATOR_URL}/prepare...`);
  const response = await fetch(`${FACILITATOR_URL}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentRequirements,
      walletAddress: CROSSMINT_WALLET_ADDRESS,
      enableTrustless: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`/prepare failed: ${response.status} ${errorText}`);
  }

  const prepareData = await response.json() as any;
  console.log(`\n✓ Got unsigned transaction from /prepare`);
  console.log(`  Base64 length: ${prepareData.transaction.length}`);

  // Decode transaction
  const transactionBytes = Uint8Array.from(atob(prepareData.transaction), c => c.charCodeAt(0));
  const txDecoder = getTransactionDecoder();
  const transaction = txDecoder.decode(transactionBytes);

  // Decode message to get account info
  const msgDecoder = getCompiledTransactionMessageDecoder();
  const message = msgDecoder.decode(transaction.messageBytes);

  console.log(`\nTransaction Info:`);
  console.log(`  Signers required: ${message.header.numSignerAccounts}`);
  console.log(`  Read-only signed: ${message.header.numReadonlySignerAccounts}`);
  console.log(`  Read-only unsigned: ${message.header.numReadonlyNonSignerAccounts}`);
  console.log(`  Total accounts: ${message.staticAccounts.length}`);
  console.log(`  Instructions: ${message.instructions.length}`);

  // Show required signers
  console.log(`\nRequired Signers:`);
  const signerAccounts = message.staticAccounts.slice(0, message.header.numSignerAccounts);
  signerAccounts.forEach((addr, i) => {
    const label = i === 0 ? "(fee payer)" : "";
    console.log(`  ${i + 1}. ${addr} ${label}`);
  });

  // Show enriched payment requirements
  if (prepareData.paymentRequirements?.extra?.feePayer) {
    console.log(`\nEnriched feePayer: ${prepareData.paymentRequirements.extra.feePayer}`);
  }

  console.log(`\n✓ Transaction structure verified`);
  console.log(`  Note: This transaction needs ${message.header.numSignerAccounts} signatures`);
  console.log(`  Use /settle endpoint to complete the signing flow`);

  return { transaction, message, prepareData };
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "help";

  console.log("=== Crossmint Transaction Test ===");
  console.log(`Mode: ${mode}`);
  console.log(`Crossmint Wallet: ${CROSSMINT_WALLET_ADDRESS}`);
  console.log(`Crossmint Locator: ${CROSSMINT_WALLET_LOCATOR}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);

  if (!CROSSMINT_API_KEY) {
    console.error("\n❌ CROSSMINT_API_KEY not set");
    process.exit(1);
  }
  if (!CROSSMINT_WALLET_ADDRESS) {
    console.error("\n❌ CROSSMINT_WALLET_ADDRESS not set");
    process.exit(1);
  }
  if (!CROSSMINT_WALLET_LOCATOR) {
    console.error("\n❌ CROSSMINT_WALLET_LOCATOR not set");
    process.exit(1);
  }

  try {
    switch (mode) {
      case "simple":
        await testSimpleTransfer();
        break;
      case "prepare":
        console.log("\n⚠️  NOTE: /prepare creates 2-signer transactions (client + facilitator)");
        console.log("   This test will fail at Crossmint because facilitator signature is missing.");
        console.log("   For full flow, use 'full-flow' mode instead.\n");
        await testPrepareSimple();
        break;
      case "trustless":
        console.log("\n⚠️  NOTE: Trustless transactions require 2 signers (client + facilitator)");
        console.log("   This test will fail at Crossmint because facilitator signature is missing.");
        console.log("   For full flow, use 'full-flow-trustless' mode instead.\n");
        await testPrepareTrustless();
        break;
      case "full-flow":
        await testFullFlow();
        break;
      case "full-flow-trustless":
        await testFullFlowTrustless();
        break;
      case "prepare-info":
        // Just show /prepare output without submitting to Crossmint
        await testPrepareInfo();
        break;
      case "help":
      default:
        console.log(`
Usage: npx tsx src/crossmint-tx-test.ts <mode>

Modes:
  simple              - Simple SOL transfer (tests Crossmint integration) ✓ WORKS
  full-flow           - USDC payment via /prepare → /settle (recommended)
  full-flow-trustless - USDC payment with trustless via /prepare → /settle
  prepare             - USDC via /prepare only (will fail - needs /settle)
  trustless           - Trustless via /prepare only (will fail - needs /settle)
  prepare-info        - Show /prepare transaction info without submitting

The /prepare endpoint creates transactions that need BOTH the client AND
facilitator to sign. The full-flow modes use /settle which handles:
  1. Detecting Crossmint wallets
  2. Coordinating signatures (facilitator first for trustless)
  3. Submitting to Crossmint API
  4. Returning jobId for trustless transactions

Examples:
  npx tsx src/crossmint-tx-test.ts simple              # Test basic Crossmint integration
  npx tsx src/crossmint-tx-test.ts full-flow           # Test USDC payment flow
  npx tsx src/crossmint-tx-test.ts full-flow-trustless # Test trustless with job registration
`);
        break;
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
