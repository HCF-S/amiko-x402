import { Hono } from "hono";
import { paymentMiddleware, type Resource, type SolanaAddress, type Network } from "@heyamiko/x402-hono";
import Exa from "exa-js";

type PaymentConfig = {
  address: `0x${string}` | SolanaAddress;
  facilitatorUrl: Resource;
  network: string;
  svmRpcUrl?: string;
};

type SearchConfig = {
  solanaMainnet?: PaymentConfig;
  solanaDevnet?: PaymentConfig;
  baseMainnet?: PaymentConfig;
  baseSepolia?: PaymentConfig;
};

// Initialize Exa client
function getExaClient(): Exa | null {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.error("EXA_API_KEY not configured");
    return null;
  }
  return new Exa(apiKey);
}

export function createSearchRoute(config: SearchConfig) {
  const app = new Hono();

  // Test endpoint for search
  app.get("/test/search", async (c) => {
    try {
      const query = c.req.query("q") || "blog post about AI";
      const exa = getExaClient();
      
      if (!exa) {
        return c.json({ error: "Exa API not configured - EXA_API_KEY is missing" }, 500);
      }

      const result = await exa.searchAndContents(query, {
        text: true,
        type: "auto"
      });

      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed";
      return c.json({ error: message }, 500);
    }
  });

  // Test endpoint for read
  app.get("/test/read", async (c) => {
    try {
      const url = c.req.query("url") || "tesla.com";
      const exa = getExaClient();
      
      if (!exa) {
        return c.json({ error: "Exa API not configured - EXA_API_KEY is missing" }, 500);
      }

      const result = await exa.getContents([url], {
        text: true
      });

      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Read failed";
      return c.json({ error: message }, 500);
    }
  });

  // Solana Mainnet Search endpoint - searches the web using Exa - costs $0.02
  if (config.solanaMainnet) {
    app.get(
      "/search",
      paymentMiddleware(
        config.solanaMainnet.address,
        {
          "GET /search": {
            price: "$0.02",
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
          const query = c.req.query("q");
          
          if (!query) {
            return c.json({ error: "Query parameter 'q' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.searchAndContents(query, {
            text: true,
            type: "auto"
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Search failed";
          return c.json({ error: message }, 500);
        }
      }
    );

    // Solana Mainnet Read endpoint - reads webpage content using Exa - costs $0.02
    app.get(
      "/read",
      paymentMiddleware(
        config.solanaMainnet.address,
        {
          "GET /read": {
            price: "$0.02",
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
          const url = c.req.query("url");
          
          if (!url) {
            return c.json({ error: "Query parameter 'url' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.getContents([url], {
            text: true
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Read failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  // Solana Devnet Search endpoint - searches the web using Exa - costs $0.02
  if (config.solanaDevnet) {
    app.get(
      "/solana-devnet/search",
      paymentMiddleware(
        config.solanaDevnet.address,
        {
          "GET /solana-devnet/search": {
            price: "$0.02",
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
          const query = c.req.query("q");
          
          if (!query) {
            return c.json({ error: "Query parameter 'q' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.searchAndContents(query, {
            text: true,
            type: "auto"
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Search failed";
          return c.json({ error: message }, 500);
        }
      }
    );

    // Solana Devnet Read endpoint - reads webpage content using Exa - costs $0.02
    app.get(
      "/solana-devnet/read",
      paymentMiddleware(
        config.solanaDevnet.address,
        {
          "GET /solana-devnet/read": {
            price: "$0.02",
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
          const url = c.req.query("url");
          
          if (!url) {
            return c.json({ error: "Query parameter 'url' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.getContents([url], {
            text: true
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Read failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  // Base Mainnet Search endpoint - searches the web using Exa - costs $0.02
  if (config.baseMainnet) {
    app.get(
      "/base/search",
      paymentMiddleware(
        config.baseMainnet.address,
        {
          "GET /base/search": {
            price: "$0.02",
            network: config.baseMainnet.network as Network,
          },
        },
        { url: config.baseMainnet.facilitatorUrl }
      ),
      async (c) => {
        try {
          const query = c.req.query("q");
          
          if (!query) {
            return c.json({ error: "Query parameter 'q' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.searchAndContents(query, {
            text: true,
            type: "auto"
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Search failed";
          return c.json({ error: message }, 500);
        }
      }
    );

    // Base Mainnet Read endpoint - reads webpage content using Exa - costs $0.02
    app.get(
      "/base/read",
      paymentMiddleware(
        config.baseMainnet.address,
        {
          "GET /base/read": {
            price: "$0.02",
            network: config.baseMainnet.network as Network,
          },
        },
        { url: config.baseMainnet.facilitatorUrl }
      ),
      async (c) => {
        try {
          const url = c.req.query("url");
          
          if (!url) {
            return c.json({ error: "Query parameter 'url' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.getContents([url], {
            text: true
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Read failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  // Base Sepolia Search endpoint - searches the web using Exa - costs $0.02
  if (config.baseSepolia) {
    app.get(
      "/base-sepolia/search",
      paymentMiddleware(
        config.baseSepolia.address,
        {
          "GET /base-sepolia/search": {
            price: "$0.02",
            network: config.baseSepolia.network as Network,
          },
        },
        { url: config.baseSepolia.facilitatorUrl }
      ),
      async (c) => {
        try {
          const query = c.req.query("q");
          
          if (!query) {
            return c.json({ error: "Query parameter 'q' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.searchAndContents(query, {
            text: true,
            type: "auto"
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Search failed";
          return c.json({ error: message }, 500);
        }
      }
    );

    // Base Sepolia Read endpoint - reads webpage content using Exa - costs $0.02
    app.get(
      "/base-sepolia/read",
      paymentMiddleware(
        config.baseSepolia.address,
        {
          "GET /base-sepolia/read": {
            price: "$0.02",
            network: config.baseSepolia.network as Network,
          },
        },
        { url: config.baseSepolia.facilitatorUrl }
      ),
      async (c) => {
        try {
          const url = c.req.query("url");
          
          if (!url) {
            return c.json({ error: "Query parameter 'url' is required" }, 400);
          }

          const exa = getExaClient();
          if (!exa) {
            return c.json({ error: "Exa API not configured" }, 500);
          }

          const result = await exa.getContents([url], {
            text: true
          });

          return c.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Read failed";
          return c.json({ error: message }, 500);
        }
      }
    );
  }

  return app;
}
