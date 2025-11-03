import { Hono } from "hono";
import { type Resource, type SolanaAddress } from "x402-hono";
import { customPaywallMiddleware } from "../middleware/customPaywall.js";

type PaymentConfig = {
  address: `0x${string}` | SolanaAddress;
  facilitatorUrl: Resource;
  network: string;
};

type OsintConfig = {
  solanaPayment?: PaymentConfig;
  basePayment?: PaymentConfig;
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

  // Solana OSINT endpoint - analyzes Twitter user profile - costs $1.00
  if (config.solanaPayment) {
    app.get(
      "/osint/:handle",
      customPaywallMiddleware(
        config.solanaPayment.address,
        {
          "GET /osint/*": {
            price: "$1.00",
            network: config.solanaPayment.network,
          },
        },
        { url: config.solanaPayment.facilitatorUrl }
      ),
      (c) => {
        const twitterHandle = c.req.param("handle");
        return c.json(getOsintResponse(twitterHandle));
      }
    );
  }

  // Base OSINT endpoint - analyzes Twitter user profile - costs $1.00
  if (config.basePayment) {
    app.get(
      "/base/osint/:handle",
      customPaywallMiddleware(
        config.basePayment.address,
        {
          "GET /base/osint/*": {
            price: "$1.00",
            network: config.basePayment.network,
          },
        },
        { url: config.basePayment.facilitatorUrl }
      ),
      (c) => {
        const twitterHandle = c.req.param("handle");
        return c.json(getOsintResponse(twitterHandle));
      }
    );
  }

  return app;
}
