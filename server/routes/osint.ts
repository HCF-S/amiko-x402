import { Hono } from "hono";
import { paymentMiddleware, type Resource, type SolanaAddress, type Network } from "x402-hono";

type PaymentConfig = {
  address: `0x${string}` | SolanaAddress;
  facilitatorUrl: Resource;
  network: string;
  svmRpcUrl?: string;
};

type OsintConfig = {
  solanaMainnet?: PaymentConfig;
  solanaDevnet?: PaymentConfig;
  baseMainnet?: PaymentConfig;
  baseSepolia?: PaymentConfig;
};

// Helper to generate OSINT response
const getOsintResponse = (twitterHandle: string) => {
  // TODO: Implement OSINT analysis logic
  // For now, return a placeholder response
  return {
    handle: twitterHandle,
    status: "pending",
    message: "OSINT analysis not yet implemented",
    timestamp: new Date().toISOString()
  };
};

export function createOsintRoute(config: OsintConfig) {
  const app = new Hono();

  // Solana Mainnet OSINT endpoint - analyzes Twitter user profile - costs $1.00
  if (config.solanaMainnet) {
    app.get(
      "/osint/:handle",
      paymentMiddleware(
        config.solanaMainnet.address,
        {
          "GET /osint/*": {
            price: "$1.00",
            network: config.solanaMainnet.network as Network,
          },
        },
        {
          url: config.solanaMainnet.facilitatorUrl,
        },
        {
          svmRpcUrl: config.solanaMainnet.svmRpcUrl,
        }
      ),
      (c) => {
        const twitterHandle = c.req.param("handle");
        return c.json(getOsintResponse(twitterHandle));
      }
    );
  }

  // Solana Devnet OSINT endpoint - analyzes Twitter user profile - costs $1.00
  if (config.solanaDevnet) {
    app.get(
      "/solana-devnet/osint/:handle",
      paymentMiddleware(
        config.solanaDevnet.address,
        {
          "GET /solana-devnet/osint/*": {
            price: "$1.00",
            network: config.solanaDevnet.network as Network,
          },
        },
        {
          url: config.solanaDevnet.facilitatorUrl,
        },
        {
          svmRpcUrl: config.solanaDevnet.svmRpcUrl,
          enableTrustless: true,
        }
      ),
      (c) => {
        const twitterHandle = c.req.param("handle");
        return c.json(getOsintResponse(twitterHandle));
      }
    );
  }

  // Base Mainnet OSINT endpoint - analyzes Twitter user profile - costs $1.00
  if (config.baseMainnet) {
    app.get(
      "/base/osint/:handle",
      paymentMiddleware(
        config.baseMainnet.address,
        {
          "GET /base/osint/*": {
            price: "$1.00",
            network: config.baseMainnet.network as Network,
          },
        },
        { url: config.baseMainnet.facilitatorUrl }
      ),
      (c) => {
        const twitterHandle = c.req.param("handle");
        return c.json(getOsintResponse(twitterHandle));
      }
    );
  }

  // Base Sepolia OSINT endpoint - analyzes Twitter user profile - costs $1.00
  if (config.baseSepolia) {
    app.get(
      "/base-sepolia/osint/:handle",
      paymentMiddleware(
        config.baseSepolia.address,
        {
          "GET /base-sepolia/osint/*": {
            price: "$1.00",
            network: config.baseSepolia.network as Network,
          },
        },
        { url: config.baseSepolia.facilitatorUrl }
      ),
      (c) => {
        const twitterHandle = c.req.param("handle");
        return c.json(getOsintResponse(twitterHandle));
      }
    );
  }

  return app;
}
