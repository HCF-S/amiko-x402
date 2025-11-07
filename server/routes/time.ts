import { Hono } from "hono";
import { paymentMiddleware, type Resource, type SolanaAddress, type Network } from "x402-hono";

type PaymentConfig = {
  address: `0x${string}` | SolanaAddress;
  facilitatorUrl: Resource;
  network: string;
  svmRpcUrl?: string;
};

type TimeConfig = {
  solanaPayment?: PaymentConfig;
  basePayment?: PaymentConfig;
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

  // Solana time endpoint - costs $0.01
  if (config.solanaPayment) {
    app.get(
      "/time",
      paymentMiddleware(
        config.solanaPayment.address,
        {
          "GET /time": {
            price: "$0.01",
            network: config.solanaPayment.network as Network,
          },
        },
        {
          url: config.solanaPayment.facilitatorUrl,
        },
        {
          svmRpcUrl: config.solanaPayment.svmRpcUrl,
        }
      ),
      (c) => {
        return c.json(getTimeResponse());
      }
    );
  }

  // Base time endpoint - costs $0.01
  if (config.basePayment) {
    app.get(
      "/base/time",
      paymentMiddleware(
        config.basePayment.address,
        {
          "GET /base/time": {
            price: "$0.01",
            network: config.basePayment.network as Network,
          },
        },
        { url: config.basePayment.facilitatorUrl }
      ),
      (c) => {
        return c.json(getTimeResponse());
      }
    );
  }

  return app;
}
