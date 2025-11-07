import { Hono } from "hono";
import { type SolanaAddress } from "x402-hono";

type NetworkConfig = {
  solanaAddress?: SolanaAddress;
  baseMainnetAddress?: `0x${string}`;
  baseSepoliaAddress?: `0x${string}`;
  hasSolanaMainnet: boolean;
  hasSolanaDevnet: boolean;
  hasBaseMainnet: boolean;
  hasBaseSepolia: boolean;
};

export function createHealthRoute(config: NetworkConfig) {
  const app = new Hono();

  app.get("/", (c) => {
    const endpoints: Record<string, any> = {};

    if (config.solanaAddress && config.hasSolanaMainnet) {
      endpoints.solanaMainnetTime = {
        path: "/time",
        method: "GET",
        cost: "$0.01",
        network: "solana",
        description: "Get current UTC time (Solana Mainnet)",
      };
      endpoints.solanaMainnetOsint = {
        path: "/osint/:handle",
        method: "GET",
        cost: "$1.00",
        network: "solana",
        description: "Twitter OSINT analysis (Solana Mainnet)",
      };
    }

    if (config.solanaAddress && config.hasSolanaDevnet) {
      endpoints.solanaDevnetTime = {
        path: "/solana-devnet/time",
        method: "GET",
        cost: "$0.01",
        network: "solana-devnet",
        description: "Get current UTC time (Solana Devnet)",
      };
      endpoints.solanaDevnetOsint = {
        path: "/solana-devnet/osint/:handle",
        method: "GET",
        cost: "$1.00",
        network: "solana-devnet",
        description: "Twitter OSINT analysis (Solana Devnet)",
      };
    }

    if (config.baseMainnetAddress && config.hasBaseMainnet) {
      endpoints.baseMainnetTime = {
        path: "/base/time",
        method: "GET",
        cost: "$0.01",
        network: "base",
        description: "Get current UTC time (Base Mainnet)",
      };
      endpoints.baseMainnetOsint = {
        path: "/base/osint/:handle",
        method: "GET",
        cost: "$1.00",
        network: "base",
        description: "Twitter OSINT analysis (Base Mainnet)",
      };
    }

    if (config.baseSepoliaAddress && config.hasBaseSepolia) {
      endpoints.baseSepoliaTime = {
        path: "/base-sepolia/time",
        method: "GET",
        cost: "$0.01",
        network: "base-sepolia",
        description: "Get current UTC time (Base Sepolia)",
      };
      endpoints.baseSepoliaOsint = {
        path: "/base-sepolia/osint/:handle",
        method: "GET",
        cost: "$1.00",
        network: "base-sepolia",
        description: "Twitter OSINT analysis (Base Sepolia)",
      };
    }

    return c.json({
      service: "Amiko x402 Server",
      status: "running",
      endpoints,
    });
  });

  return app;
}
