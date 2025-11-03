import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { paymentMiddleware, type Resource, type SolanaAddress } from "x402-hono";
import { getPaywallHtml } from "./paywall/index.js";
config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const baseAddress = process.env.BASE_ADDRESS as `0x${string}`;
const solanaAddress = process.env.SOLANA_ADDRESS as SolanaAddress;
const svmRpcUrl = process.env.SVM_RPC_URL;
const PORT = Number(process.env.PORT) || 3001;
const USE_MAINNET = process.env.USE_MAINNET === "true";

// Custom paywall middleware wrapper that uses our getPaywallHtml function
function customPaywallMiddleware(
  address: `0x${string}` | SolanaAddress,
  routes: any,
  facilitatorConfig: any
) {
  const baseMiddleware = paymentMiddleware(address, routes, facilitatorConfig);
  
  return async (c: any, next: any) => {
    // Call the x402-hono middleware
    const result = await baseMiddleware(c, next);
    
    // If it's a 402 response with HTML, extract config and use our custom paywall
    if (result && result.status === 402) {
      const body = await result.text();
      if (body.includes('window.x402')) {
        try {
          const configMatch = body.match(/window\.x402\s*=\s*({[\s\S]*?});/);
          if (configMatch) {
            const configStr = configMatch[1];
            const x402Config = eval(`(${configStr})`);
            
            const customHtml = getPaywallHtml({
              amount: x402Config.amount,
              paymentRequirements: x402Config.paymentRequirements,
              currentUrl: x402Config.currentUrl,
              testnet: x402Config.testnet,
              appName: x402Config.appName || "Amiko x402 Server",
              appLogo: x402Config.appLogo,
              cdpClientKey: x402Config.cdpClientKey || process.env.CDP_CLIENT_KEY,
              sessionTokenEndpoint: x402Config.sessionTokenEndpoint,
            });
            return c.html(customHtml, 402);
          }
        } catch (error) {
          console.error('Failed to parse x402 config from paywall HTML:', error);
        }
      }
      return result;
    }
    
    return result;
  };
}

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


// Apply Solana payment middleware
if (solanaAddress) {
  app.use(
    "*",
    customPaywallMiddleware(
      solanaAddress,
      {
        "GET /time": {
          price: "$0.01",
          network: getNetworkName(true),
        },
        "GET /osint": {
          price: "$1.00",
          network: getNetworkName(true),
        },
      },
      { url: facilitatorUrl },
    ),
  );
}

// Apply Base payment middleware
if (baseAddress) {
  app.use(
    "*",
    customPaywallMiddleware(
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
app.get("/", (c) => {
  const endpoints: Record<string, any> = {};

  if (solanaAddress) {
    endpoints.time = {
      path: "/time",
      method: "GET",
      cost: "$0.01",
      network: getNetworkName(true),
      description: "Get current UTC time (Solana)",
    };
    endpoints.osint = {
      path: "/osint",
      method: "GET",
      cost: "$1.00",
      network: getNetworkName(true),
      description: "Twitter OSINT analysis (requires ?handle=username)",
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

  return c.json({
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
  app.get("/time", (c) => {
    return c.json(getTimeResponse(true));
  });
}

// Base time endpoint - costs $0.01
// Payment is automatically handled by x402-express middleware
if (baseAddress) {
  app.get("/base/time", (c) => {
    return c.json(getTimeResponse(false));
  });
}

// OSINT endpoint - analyzes Twitter user profile
// Payment is automatically handled by x402-express middleware
if (solanaAddress) {
  app.get("/osint", (c) => {
    const twitterHandle = c.req.query("handle");
    
    if (!twitterHandle) {
      return c.json({
        error: "Missing required parameter: handle",
        usage: "GET /osint?handle=username"
      }, 400);
    }
    
    // TODO: Implement OSINT analysis logic
    // For now, return a placeholder response
    return c.json({
      handle: twitterHandle,
      status: "pending",
      message: "OSINT analysis not yet implemented",
      timestamp: new Date().toISOString()
    });
  });
}

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
  console.log(`  GET /osint?handle=<twitter_handle> - Twitter OSINT analysis ($1.00) [${getNetworkDisplayName(true)}]`);
}

if (baseAddress) {
  console.log(`  GET /base/time - Current UTC time ($0.01) [${getNetworkDisplayName(false)}]`);
}

serve({
  fetch: app.fetch,
  port: PORT,
});
