import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { type Resource, type SolanaAddress } from "x402-hono";

import { createHealthRoute } from "./routes/health.js";
import { createTimeRoutes } from "./routes/time.js";
import { createOsintRoute } from "./routes/osint.js";
config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const baseMainnetAddress = process.env.BASE_MAINNET_ADDRESS as `0x${string}`;
const baseSepoliaAddress = process.env.BASE_SEPOLIA_ADDRESS as `0x${string}`;
const solanaAddress = process.env.SOLANA_ADDRESS as SolanaAddress;
const svmRpcMainnetUrl = process.env.SVM_RPC_MAINNET_URL;
const svmRpcDevnetUrl = process.env.SVM_RPC_DEVNET_URL;
const PORT = Number(process.env.PORT) || 3001;

if (!facilitatorUrl) {
  console.error("Missing required environment variable: FACILITATOR_URL");
  process.exit(1);
}

if (!baseMainnetAddress && !baseSepoliaAddress && !solanaAddress) {
  console.error("Missing required environment variables: At least one of BASE_MAINNET_ADDRESS, BASE_SEPOLIA_ADDRESS, or SOLANA_ADDRESS");
  process.exit(1);
}

const app = new Hono();

// Create payment middleware configurations
const solanaMainnetConfig = solanaAddress && svmRpcMainnetUrl ? {
  address: solanaAddress,
  facilitatorUrl,
  network: "solana",
  svmRpcUrl: svmRpcMainnetUrl,
} : undefined;

const solanaDevnetConfig = solanaAddress && svmRpcDevnetUrl ? {
  address: solanaAddress,
  facilitatorUrl,
  network: "solana-devnet",
  svmRpcUrl: svmRpcDevnetUrl,
} : undefined;

const baseMainnetConfig = baseMainnetAddress ? {
  address: baseMainnetAddress,
  facilitatorUrl,
  network: "base",
} : undefined;

const baseSepoliaConfig = baseSepoliaAddress ? {
  address: baseSepoliaAddress,
  facilitatorUrl,
  network: "base-sepolia",
} : undefined;

// Register routes
app.route("/", createHealthRoute({
  solanaAddress,
  baseMainnetAddress,
  baseSepoliaAddress,
  hasSolanaMainnet: !!svmRpcMainnetUrl,
  hasSolanaDevnet: !!svmRpcDevnetUrl,
  hasBaseMainnet: !!baseMainnetAddress,
  hasBaseSepolia: !!baseSepoliaAddress,
}));

app.route("/", createTimeRoutes({
  solanaMainnet: solanaMainnetConfig,
  solanaDevnet: solanaDevnetConfig,
  baseMainnet: baseMainnetConfig,
  baseSepolia: baseSepoliaConfig,
}));

app.route("/", createOsintRoute({
  solanaMainnet: solanaMainnetConfig,
  solanaDevnet: solanaDevnetConfig,
  baseMainnet: baseMainnetConfig,
  baseSepolia: baseSepoliaConfig,
}));

// Start server
console.log(`🚀 Amiko x402 Server running at http://localhost:${PORT}`);
console.log(`Facilitator: ${facilitatorUrl}`);

if (svmRpcMainnetUrl) {
  console.log(`Solana Mainnet RPC: ${svmRpcMainnetUrl}`);
}

if (svmRpcDevnetUrl) {
  console.log(`Solana Devnet RPC: ${svmRpcDevnetUrl}`);
}

console.log(`\nAvailable endpoints:`);

if (solanaMainnetConfig) {
  console.log(`  GET /time - Current UTC time ($0.01) [Solana Mainnet]`);
  console.log(`  GET /osint/:handle - Twitter OSINT analysis ($1.00) [Solana Mainnet]`);
}

if (solanaDevnetConfig) {
  console.log(`  GET /solana-devnet/time - Current UTC time ($0.01) [Solana Devnet]`);
  console.log(`  GET /solana-devnet/osint/:handle - Twitter OSINT analysis ($1.00) [Solana Devnet]`);
}

if (baseMainnetConfig) {
  console.log(`  GET /base/time - Current UTC time ($0.01) [Base Mainnet]`);
  console.log(`  GET /base/osint/:handle - Twitter OSINT analysis ($1.00) [Base Mainnet]`);
}

if (baseSepoliaConfig) {
  console.log(`  GET /base-sepolia/time - Current UTC time ($0.01) [Base Sepolia]`);
  console.log(`  GET /base-sepolia/osint/:handle - Twitter OSINT analysis ($1.00) [Base Sepolia]`);
}

serve({
  fetch: app.fetch,
  port: PORT,
});
