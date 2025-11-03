import express, { Request, Response } from "express";
import { config } from "dotenv";
import { paymentMiddleware, Resource, type SolanaAddress } from "x402-express";
config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const baseAddress = process.env.BASE_ADDRESS as `0x${string}`;
const solanaAddress = process.env.SOLANA_ADDRESS as SolanaAddress;
const svmRpcUrl = process.env.SVM_RPC_URL;
const PORT = process.env.PORT || 3001;
const USE_MAINNET = process.env.USE_MAINNET === "true";

if (!facilitatorUrl) {
  console.error("Missing required environment variable: FACILITATOR_URL");
  process.exit(1);
}

if (!baseAddress && !solanaAddress) {
  console.error("Missing required environment variables: BASE_ADDRESS or SOLANA_ADDRESS");
  process.exit(1);
}

const app = express();

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


// Apply Solana payment middleware
if (solanaAddress) {
  app.use(
    paymentMiddleware(
      solanaAddress,
      {
        "GET /time": {
          price: "$0.01",
          network: getNetworkName(true),
          config:{
            customPaywallHtml: 'hello',
          }
        },
      },
      { url: facilitatorUrl },
    ),
  );
}

// Apply Base payment middleware
if (baseAddress) {
  app.use(
    paymentMiddleware(
      baseAddress,
      {
        "GET /base/time": {
          price: "$0.01",
          network: getNetworkName(false),
        },
      },
      { url: facilitatorUrl },
    ),
  );
}

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  const endpoints: Record<string, any> = {};

  if (solanaAddress) {
    endpoints.time = {
      path: "/time",
      method: "GET",
      cost: "$0.01",
      network: getNetworkName(true),
      description: "Get current UTC time (Solana)",
    };
  }

  if (baseAddress) {
    endpoints.baseTime = {
      path: "/base/time",
      method: "GET",
      cost: "$0.01",
      network: getNetworkName(false),
      description: "Get current UTC time (Base)",
    };
  }

  res.json({
    service: "Amiko x402 Server",
    status: "running",
    mode: USE_MAINNET ? "MAINNET" : "TESTNET",
    endpoints,
  });
});

// Helper to generate time response
const getTimeResponse = (isSolana: boolean) => {
  const currentTime = new Date().toISOString();
  return {
    time: currentTime,
    timezone: "UTC",
    unix: Math.floor(Date.now() / 1000),
    formatted: new Date().toUTCString(),
    network: getNetworkName(isSolana),
  };
};

// Solana time endpoint - costs $0.01
// Payment is automatically handled by x402-express middleware
if (solanaAddress) {
  app.get("/time", (req: Request, res: Response) => {
    res.json(getTimeResponse(true));
  });
}

// Base time endpoint - costs $0.01
// Payment is automatically handled by x402-express middleware
if (baseAddress) {
  app.get("/base/time", (req: Request, res: Response) => {
    res.json(getTimeResponse(false));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Amiko x402 Server running at http://localhost:${PORT}`);
  console.log(`Mode: ${USE_MAINNET ? "MAINNET" : "TESTNET"}`);
  console.log(`Facilitator: ${facilitatorUrl}`);
  
  if (svmRpcUrl) {
    console.log(`Solana RPC: ${svmRpcUrl}`);
  }
  
  console.log(`\nAvailable endpoints:`);
  
  if (solanaAddress) {
    console.log(`  GET /time - Current UTC time ($0.01) [${getNetworkDisplayName(true)}]`);
  }
  
  if (baseAddress) {
    console.log(`  GET /base/time - Current UTC time ($0.01) [${getNetworkDisplayName(false)}]`);
  }
});
