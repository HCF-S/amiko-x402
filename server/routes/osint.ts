import { Hono } from "hono";
import { paymentMiddleware, type Resource, type SolanaAddress, type Network } from "x402-hono";
import { analyzeTwitterProfile } from "../services/osint.js";

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

export function createOsintRoute(config: OsintConfig) {
  const app = new Hono();

  // Test endpoint
  app.get("/test/osint/:handle", async (c) => {
    try {
      const twitterHandle = c.req.param("handle");
      const profile = await analyzeTwitterProfile(twitterHandle);
      return c.json(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      return c.json({ error: message }, 500);
    }
  });

  // Solana Mainnet OSINT endpoint - analyzes Twitter user profile - costs $0.10
  if (config.solanaMainnet) {
    app.post(
      "/osint/:handle",
      paymentMiddleware(
        config.solanaMainnet.address,
        {
          "POST /osint/*": {
            price: "$0.10",
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
      async (c) => {
        try {
          const twitterHandle = c.req.param("handle");
          const profile = await analyzeTwitterProfile(twitterHandle);
          return c.json(profile);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Analysis failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  // Solana Devnet OSINT endpoint - analyzes Twitter user profile - costs $0.10
  if (config.solanaDevnet) {
    app.post(
      "/solana-devnet/osint/:handle",
      paymentMiddleware(
        config.solanaDevnet.address,
        {
          "POST /solana-devnet/osint/*": {
            price: "$0.10",
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
      async (c) => {
        try {
          const twitterHandle = c.req.param("handle");
          const profile = await analyzeTwitterProfile(twitterHandle);
          return c.json(profile);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Analysis failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  // Base Mainnet OSINT endpoint - analyzes Twitter user profile - costs $0.10
  if (config.baseMainnet) {
    app.post(
      "/base/osint/:handle",
      paymentMiddleware(
        config.baseMainnet.address,
        {
          "POST /base/osint/*": {
            price: "$0.10",
            network: config.baseMainnet.network as Network,
          },
        },
        { url: config.baseMainnet.facilitatorUrl }
      ),
      async (c) => {
        try {
          const twitterHandle = c.req.param("handle");
          const profile = await analyzeTwitterProfile(twitterHandle);
          return c.json(profile);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Analysis failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  // Base Sepolia OSINT endpoint - analyzes Twitter user profile - costs $0.10
  if (config.baseSepolia) {
    app.post(
      "/base-sepolia/osint/:handle",
      paymentMiddleware(
        config.baseSepolia.address,
        {
          "POST /base-sepolia/osint/*": {
            price: "$0.10",
            network: config.baseSepolia.network as Network,
          },
        },
        { url: config.baseSepolia.facilitatorUrl }
      ),
      async (c) => {
        try {
          const twitterHandle = c.req.param("handle");
          const profile = await analyzeTwitterProfile(twitterHandle);
          return c.json(profile);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Analysis failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  return app;
}
