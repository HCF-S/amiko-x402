import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { type Resource, type SolanaAddress } from "x402-hono";

import { createHealthRoute } from "./routes/health.js";
import { createTimeRoutes } from "./routes/time.js";
import { createWeatherRoutes } from "./routes/weather.js";
import { createOsintRoute } from "./routes/osint.js";
import { createSearchRoute } from "./routes/search.js";
config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const baseMainnetAddress = process.env.BASE_MAINNET_ADDRESS as `0x${string}`;
const baseSepoliaAddress = process.env.BASE_SEPOLIA_ADDRESS as `0x${string}`;
const solanaAddress = process.env.SOLANA_ADDRESS as SolanaAddress;
const svmRpcMainnetUrl = process.env.SVM_MAINNET_RPC_URL;
const svmRpcDevnetUrl = process.env.SVM_DEVNET_RPC_URL;
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

app.route("/", createWeatherRoutes({
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

app.route("/", createSearchRoute({
  solanaMainnet: solanaMainnetConfig,
  solanaDevnet: solanaDevnetConfig,
  baseMainnet: baseMainnetConfig,
  baseSepolia: baseSepoliaConfig,
}));

// Start server
console.log(`🚀 Amiko x402 Server running at http://localhost:${PORT}`);
console.log(`Facilitator: ${facilitatorUrl}`);

console.log(`\nAvailable endpoints:`);

if (solanaMainnetConfig) {
  console.log(`  GET /time - Current UTC time ($0.01) [Solana Mainnet]`);
  console.log(`  GET /weather?location=XXX - Weather information ($0.02) [Solana Mainnet]`);
  console.log(`  GET /osint/:handle - Twitter OSINT analysis ($0.10) [Solana Mainnet]`);
  console.log(`  GET /search?q=query - Web search using Exa ($0.02) [Solana Mainnet]`);
  console.log(`  GET /read?url=example.com - Read webpage content ($0.02) [Solana Mainnet]`);
}

if (solanaDevnetConfig) {
  console.log(`  GET /solana-devnet/time - Current UTC time ($0.01) [Solana Devnet]`);
  console.log(`  GET /solana-devnet/weather?location=XXX - Weather information ($0.02) [Solana Devnet]`);
  console.log(`  GET /solana-devnet/osint/:handle - Twitter OSINT analysis ($0.10) [Solana Devnet]`);
  console.log(`  GET /solana-devnet/search?q=query - Web search using Exa ($0.02) [Solana Devnet]`);
  console.log(`  GET /solana-devnet/read?url=example.com - Read webpage content ($0.02) [Solana Devnet]`);
}

if (baseMainnetConfig) {
  console.log(`  GET /base/time - Current UTC time ($0.01) [Base Mainnet]`);
  console.log(`  GET /base/weather?location=XXX - Weather information ($0.02) [Base Mainnet]`);
  console.log(`  GET /base/osint/:handle - Twitter OSINT analysis ($0.10) [Base Mainnet]`);
  console.log(`  GET /base/search?q=query - Web search using Exa ($0.02) [Base Mainnet]`);
  console.log(`  GET /base/read?url=example.com - Read webpage content ($0.02) [Base Mainnet]`);
}

if (baseSepoliaConfig) {
  console.log(`  GET /base-sepolia/time - Current UTC time ($0.01) [Base Sepolia]`);
  console.log(`  GET /base-sepolia/weather?location=XXX - Weather information ($0.02) [Base Sepolia]`);
  console.log(`  GET /base-sepolia/osint/:handle - Twitter OSINT analysis ($0.10) [Base Sepolia]`);
  console.log(`  GET /base-sepolia/search?q=query - Web search using Exa ($0.02) [Base Sepolia]`);
  console.log(`  GET /base-sepolia/read?url=example.com - Read webpage content ($0.02) [Base Sepolia]`);
}

serve({
  fetch: app.fetch,
  port: PORT,
});
