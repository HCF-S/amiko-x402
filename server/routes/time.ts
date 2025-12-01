import { Hono } from "hono";
import { paymentMiddleware, type Resource, type SolanaAddress, type Network } from "@heyamiko/x402-hono";

type PaymentConfig = {
  address: `0x${string}` | SolanaAddress;
  facilitatorUrl: Resource;
  network: string;
  svmRpcUrl?: string;
};

type TimeConfig = {
  solanaMainnet?: PaymentConfig;
  solanaDevnet?: PaymentConfig;
  baseMainnet?: PaymentConfig;
  baseSepolia?: PaymentConfig;
};

// Helper to generate time response
const getTimeResponse = () => {
  const currentTime = new Date().toISOString();
  return {
    time: currentTime,
    timezone: "UTC",
    unix: Math.floor(Date.now() / 1000),
    formatted: new Date().toUTCString(),
  };
};

export function createTimeRoutes(config: TimeConfig) {
  const app = new Hono();

  // Solana Mainnet time endpoint - costs $0.01
  if (config.solanaMainnet) {
    app.get(
      "/time",
      paymentMiddleware(
        config.solanaMainnet.address,
        {
          "GET /time": {
            price: "$0.01",
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
        return c.json(getTimeResponse());
      }
    );
  }

  // Solana Devnet time endpoint - costs $0.01
  if (config.solanaDevnet) {
    app.get(
      "/solana-devnet/time",
      paymentMiddleware(
        config.solanaDevnet.address,
        {
          "GET /solana-devnet/time": {
            price: "$0.01",
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
        return c.json(getTimeResponse());
      }
    );
  }

  // Base Mainnet time endpoint - costs $0.01
  if (config.baseMainnet) {
    app.get(
      "/base/time",
      paymentMiddleware(
        config.baseMainnet.address,
        {
          "GET /base/time": {
            price: "$0.01",
            network: config.baseMainnet.network as Network,
          },
        },
        { url: config.baseMainnet.facilitatorUrl }
      ),
      (c) => {
        return c.json(getTimeResponse());
      }
    );
  }

  // Base Sepolia time endpoint - costs $0.01
  if (config.baseSepolia) {
    app.get(
      "/base-sepolia/time",
      paymentMiddleware(
        config.baseSepolia.address,
        {
          "GET /base-sepolia/time": {
            price: "$0.01",
            network: config.baseSepolia.network as Network,
          },
        },
        { url: config.baseSepolia.facilitatorUrl }
      ),
      (c) => {
        return c.json(getTimeResponse());
      }
    );
  }

  return app;
}
