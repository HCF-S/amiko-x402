import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { type Resource, type SolanaAddress } from "x402-hono";

import { createHealthRoute } from "./routes/health.js";
import { createTimeRoutes } from "./routes/time.js";
import { createOsintRoute } from "./routes/osint.js";
config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const baseAddress = process.env.BASE_ADDRESS as `0x${string}`;
const solanaAddress = process.env.SOLANA_ADDRESS as SolanaAddress;
const svmRpcUrl = process.env.SVM_RPC_URL;
const PORT = Number(process.env.PORT) || 3001;
const USE_MAINNET = process.env.USE_MAINNET === "true";

if (!facilitatorUrl) {
  console.error("Missing required environment variable: FACILITATOR_URL");
  process.exit(1);
}

if (!baseAddress && !solanaAddress) {
  console.error("Missing required environment variables: BASE_ADDRESS or SOLANA_ADDRESS");
  process.exit(1);
}

const app = new Hono();

// Network configuration helpers
const getNetworkName = (isSolana: boolean) => {
  if (isSolana) {
    return USE_MAINNET ? "solana" : "solana-devnet";
  }
  return USE_MAINNET ? "base" : "base-sepolia";
};

const getNetworkDisplayName = (isSolana: boolean) => {
  if (isSolana) {
    return USE_MAINNET ? "Solana Mainnet" : "Solana Devnet";
  }
  return USE_MAINNET ? "Base" : "Base Sepolia";
};

// Create payment middleware configurations
const solanaPaymentConfig = solanaAddress ? {
  address: solanaAddress,
  facilitatorUrl,
  network: getNetworkName(true),
  svmRpcUrl,
} : undefined;

const basePaymentConfig = baseAddress ? {
  address: baseAddress,
  facilitatorUrl,
  network: getNetworkName(false),
} : undefined;

// Register routes
app.route("/", createHealthRoute({
  solanaAddress,
  baseAddress,
  useMainnet: USE_MAINNET,
  getNetworkName,
}));

app.route("/", createTimeRoutes({
  solanaPayment: solanaPaymentConfig,
  basePayment: basePaymentConfig,
}));

app.route("/", createOsintRoute({
  solanaPayment: solanaPaymentConfig,
  basePayment: basePaymentConfig,
}));

// Start server
console.log(`🚀 Amiko x402 Server running at http://localhost:${PORT}`);
console.log(`Mode: ${USE_MAINNET ? "MAINNET" : "TESTNET"}`);
console.log(`Facilitator: ${facilitatorUrl}`);

if (svmRpcUrl) {
  console.log(`Solana RPC: ${svmRpcUrl}`);
}

console.log(`\nAvailable endpoints:`);

if (solanaAddress) {
  console.log(`  GET /time - Current UTC time ($0.01) [${getNetworkDisplayName(true)}]`);
  console.log(`  GET /osint/:handle - Twitter OSINT analysis ($1.00) [${getNetworkDisplayName(true)}]`);
}

if (baseAddress) {
  console.log(`  GET /base/time - Current UTC time ($0.01) [${getNetworkDisplayName(false)}]`);
  console.log(`  GET /base/osint/:handle - Twitter OSINT analysis ($1.00) [${getNetworkDisplayName(false)}]`);
}

serve({
  fetch: app.fetch,
  port: PORT,
});
