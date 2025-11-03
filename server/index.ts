import express, { Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import { paymentMiddleware, Resource, type SolanaAddress } from "x402-express";
import { getPaywallHtml } from "./paywall/index";
config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const baseAddress = process.env.BASE_ADDRESS as `0x${string}`;
const solanaAddress = process.env.SOLANA_ADDRESS as SolanaAddress;
const svmRpcUrl = process.env.SVM_RPC_URL;
const PORT = process.env.PORT || 3001;
const USE_MAINNET = process.env.USE_MAINNET === "true";

// Custom paywall middleware wrapper that uses our getPaywallHtml function
function customPaywallMiddleware(
  address: `0x${string}` | SolanaAddress,
  routes: any,
  facilitatorConfig: any
) {
  const baseMiddleware = paymentMiddleware(address, routes, facilitatorConfig);
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Intercept the response to inject custom paywall HTML
    const originalSend = res.send;
    const originalStatus = res.status;
    let statusCode = 200;
    
    res.status = function(code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
    res.send = function(body: any) {
      // If it's a 402 response with HTML, extract config and use our custom paywall
      if (statusCode === 402 && typeof body === 'string' && body.includes('window.x402')) {
        try {
          // Extract the window.x402 configuration from the default paywall HTML
          const configMatch = body.match(/window\.x402\s*=\s*({[\s\S]*?});/);
          if (configMatch) {
            // Parse the configuration (safely)
            const configStr = configMatch[1];
            const x402Config = eval(`(${configStr})`);
            
            // Generate our custom paywall HTML with the same configuration
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
            return originalSend.call(this, customHtml);
          }
        } catch (error) {
          console.error('Failed to parse x402 config from paywall HTML:', error);
        }
      }
      return originalSend.call(this, body);
    };
    
    baseMiddleware(req, res, next);
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
    customPaywallMiddleware(
      solanaAddress,
      {
        "GET /time": {
          price: "$0.01",
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
