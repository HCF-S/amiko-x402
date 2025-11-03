import { Hono } from "hono";
import { type SolanaAddress } from "x402-hono";

type NetworkConfig = {
  solanaAddress?: SolanaAddress;
  baseAddress?: `0x${string}`;
  useMainnet: boolean;
  getNetworkName: (isSolana: boolean) => string;
};

export function createHealthRoute(config: NetworkConfig) {
  const app = new Hono();

  app.get("/", (c) => {
    const endpoints: Record<string, any> = {};

    if (config.solanaAddress) {
      endpoints.time = {
        path: "/time",
        method: "GET",
        cost: "$0.01",
        network: config.getNetworkName(true),
        description: "Get current UTC time (Solana)",
      };
      endpoints.osint = {
        path: "/osint/:handle",
        method: "GET",
        cost: "$1.00",
        network: config.getNetworkName(true),
        description: "Twitter OSINT analysis",
      };
    }

    if (config.baseAddress) {
      endpoints.baseTime = {
        path: "/base/time",
        method: "GET",
        cost: "$0.01",
        network: config.getNetworkName(false),
        description: "Get current UTC time (Base)",
      };
      endpoints.baseOsint = {
        path: "/base/osint/:handle",
        method: "GET",
        cost: "$1.00",
        network: config.getNetworkName(false),
        description: "Twitter OSINT analysis (Base)",
      };
    }

    return c.json({
      service: "Amiko x402 Server",
      status: "running",
      mode: config.useMainnet ? "MAINNET" : "TESTNET",
      endpoints,
    });
  });

  return app;
}
