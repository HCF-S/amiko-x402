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
        method: "POST",
        cost: "$0.10",
        network: "solana",
        description: "Twitter OSINT analysis (Solana Mainnet)",
      };
      endpoints.solanaMainnetSearch = {
        path: "/search?q=query",
        method: "GET",
        cost: "$0.02",
        network: "solana",
        description: "Web search using Exa (Solana Mainnet)",
      };
      endpoints.solanaMainnetRead = {
        path: "/read?url=example.com",
        method: "GET",
        cost: "$0.02",
        network: "solana",
        description: "Read webpage content (Solana Mainnet)",
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
        method: "POST",
        cost: "$0.10",
        network: "solana-devnet",
        description: "Twitter OSINT analysis (Solana Devnet)",
      };
      endpoints.solanaDevnetSearch = {
        path: "/solana-devnet/search?q=query",
        method: "GET",
        cost: "$0.02",
        network: "solana-devnet",
        description: "Web search using Exa (Solana Devnet)",
      };
      endpoints.solanaDevnetRead = {
        path: "/solana-devnet/read?url=example.com",
        method: "GET",
        cost: "$0.02",
        network: "solana-devnet",
        description: "Read webpage content (Solana Devnet)",
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
        method: "POST",
        cost: "$0.10",
        network: "base",
        description: "Twitter OSINT analysis (Base Mainnet)",
      };
      endpoints.baseMainnetSearch = {
        path: "/base/search?q=query",
        method: "GET",
        cost: "$0.02",
        network: "base",
        description: "Web search using Exa (Base Mainnet)",
      };
      endpoints.baseMainnetRead = {
        path: "/base/read?url=example.com",
        method: "GET",
        cost: "$0.02",
        network: "base",
        description: "Read webpage content (Base Mainnet)",
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
        method: "POST",
        cost: "$0.10",
        network: "base-sepolia",
        description: "Twitter OSINT analysis (Base Sepolia)",
      };
      endpoints.baseSepoliaSearch = {
        path: "/base-sepolia/search?q=query",
        method: "GET",
        cost: "$0.02",
        network: "base-sepolia",
        description: "Web search using Exa (Base Sepolia)",
      };
      endpoints.baseSepoliaRead = {
        path: "/base-sepolia/read?url=example.com",
        method: "GET",
        cost: "$0.02",
        network: "base-sepolia",
        description: "Read webpage content (Base Sepolia)",
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
