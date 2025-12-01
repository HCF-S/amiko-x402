import { config } from "dotenv";
import express, { Request, Response } from "express";
import { verify, settle } from "@heyamiko/x402/facilitator";
import { createUnsignedTransaction } from "@heyamiko/x402/client";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  createSigner,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  Signer,
  ConnectedClient,
  SupportedPaymentKind,
  isSvmSignerWallet,
  type X402Config,
} from "@heyamiko/x402/types";
import { getFacilitatorPage } from "./page.js";

config();

const BASE_MAINNET_PRIVATE_KEY = process.env.BASE_MAINNET_PRIVATE_KEY || "";
const BASE_SEPOLIA_PRIVATE_KEY = process.env.BASE_SEPOLIA_PRIVATE_KEY || "";
const SVM_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY || "";
const SVM_MAINNET_RPC_URL = process.env.SVM_MAINNET_RPC_URL || "";
const SVM_DEVNET_RPC_URL = process.env.SVM_DEVNET_RPC_URL || "";
const TRUSTLESS_PROGRAM_ID = process.env.TRUSTLESS_PROGRAM_ID || "";
const PORT = process.env.PORT || 3000;

if (!BASE_MAINNET_PRIVATE_KEY && !BASE_SEPOLIA_PRIVATE_KEY && !SVM_PRIVATE_KEY) {
  console.error("Missing required environment variables: At least one of BASE_MAINNET_PRIVATE_KEY, BASE_SEPOLIA_PRIVATE_KEY, or SVM_PRIVATE_KEY");
  process.exit(1);
}

// Helper to get X402 config for a specific network
const getX402Config = (network: string): X402Config | undefined => {
  if (network === "solana" && SVM_MAINNET_RPC_URL) {
    return {
      svmConfig: {
        rpcUrl: SVM_MAINNET_RPC_URL,
      },
    };
  }
  if (network === "solana-devnet" && SVM_DEVNET_RPC_URL) {
    return {
      svmConfig: {
        rpcUrl: SVM_DEVNET_RPC_URL,
      },
    };
  }
  return undefined;
};

const app = express();

// Configure express to parse JSON bodies
app.use(express.json());

// Add CORS headers for API access
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

type PrepareRequest = {
  paymentRequirements: PaymentRequirements;
  walletAddress: string;
  enableTrustless?: boolean;
};

type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

// Health check endpoint - HTML page
app.get("/", (req: Request, res: Response) => {
  const networks: string[] = [];
  if (BASE_MAINNET_PRIVATE_KEY) networks.push("Base Mainnet");
  if (BASE_SEPOLIA_PRIVATE_KEY) networks.push("Base Sepolia");
  if (SVM_PRIVATE_KEY && SVM_MAINNET_RPC_URL) networks.push("Solana Mainnet");
  if (SVM_PRIVATE_KEY && SVM_DEVNET_RPC_URL) networks.push("Solana Devnet");
  
  const html = getFacilitatorPage({
    networks,
  });
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Get supported payment kinds
app.get("/supported", async (req: Request, res: Response) => {
  try {
    const kinds: SupportedPaymentKind[] = [];

    // Base Mainnet
    if (BASE_MAINNET_PRIVATE_KEY) {
      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "base",
      });
    }

    // Base Sepolia
    if (BASE_SEPOLIA_PRIVATE_KEY) {
      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
      });
    }

    // Solana Mainnet
    if (SVM_PRIVATE_KEY && SVM_MAINNET_RPC_URL) {
      const signer = await createSigner("solana", SVM_PRIVATE_KEY);
      const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "solana",
        extra: {
          feePayer,
        },
      });
    }

    // Solana Devnet
    if (SVM_PRIVATE_KEY && SVM_DEVNET_RPC_URL) {
      const signer = await createSigner("solana-devnet", SVM_PRIVATE_KEY);
      const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "solana-devnet",
        extra: {
          feePayer,
        },
      });
    }

    res.json({ kinds });
  } catch (error) {
    console.error("Error getting supported kinds:", error);
    res.status(500).json({ error: "Failed to get supported payment kinds" });
  }
});

// Prepare endpoint info
app.get("/prepare", (req: Request, res: Response) => {
  res.json({
    endpoint: "/prepare",
    description: "POST to prepare unsigned transactions for client wallets to sign",
    method: "POST",
    body: {
      paymentRequirements: "PaymentRequirements object from 402 response",
      walletAddress: "string - Client's Solana wallet address",
      enableTrustless: "boolean (optional) - Include trustless register_job instruction",
    },
    response: {
      transaction: "string - Base64 encoded unsigned transaction",
      paymentRequirements: "PaymentRequirements - Enriched with fee payer",
    },
    notes: [
      "Only supports Solana (SVM) networks",
      "Facilitator acts as fee payer for the transaction",
      "Client must sign the transaction with their wallet before submitting",
      "If enableTrustless is true, includes on-chain job registration",
    ],
  });
});

// Prepare endpoint - creates unsigned transaction for client to sign
app.post("/prepare", async (req: Request, res: Response) => {
  try {
    console.log("\n=== PREPARE REQUEST ===");
    const body: PrepareRequest = req.body;
    console.log("Wallet Address:", body.walletAddress);
    console.log("Enable Trustless:", body.enableTrustless);
    
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    
    // Only support SVM networks for now
    if (!SupportedSVMNetworks.includes(paymentRequirements.network)) {
      throw new Error(`Prepare endpoint only supports SVM networks. Received: ${paymentRequirements.network}`);
    }

    // Get the facilitator's address to use as fee payer
    const signer = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;
    
    if (!feePayer) {
      throw new Error("Failed to get fee payer address from signer");
    }

    // Add fee payer to payment requirements
    const enrichedPaymentRequirements: PaymentRequirements = {
      ...paymentRequirements,
      extra: {
        ...paymentRequirements.extra,
        feePayer,
      },
    };

    // Get config for the network
    const baseConfig = getX402Config(paymentRequirements.network);
    
    // Create config with trustless program ID if enabled (only for devnet)
    const prepareConfig: X402Config | undefined = body.enableTrustless && TRUSTLESS_PROGRAM_ID && paymentRequirements.network === "solana-devnet"
      ? {
          ...baseConfig,
          svmConfig: {
            ...baseConfig?.svmConfig,
            trustlessProgramId: TRUSTLESS_PROGRAM_ID,
          },
        }
      : baseConfig;

    console.log("Creating unsigned transaction...");
    const unsignedTransaction = await createUnsignedTransaction(
      body.walletAddress,
      enrichedPaymentRequirements,
      prepareConfig,
    );
    
    console.log("Unsigned transaction created successfully");
    console.log("=== PREPARE COMPLETE ===\n");
    
    res.json({
      transaction: unsignedTransaction,
      paymentRequirements: enrichedPaymentRequirements,
    });
  } catch (error) {
    console.error("Prepare error:", error);
    res.status(400).json({
      error: "Invalid request",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Verify endpoint info
app.get("/verify", (req: Request, res: Response) => {
  res.json({
    endpoint: "/verify",
    description: "POST to verify x402 payments",
    method: "POST",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

// Verify payment
app.post("/verify", async (req: Request, res: Response) => {
  try {
    console.log("\n=== VERIFY REQUEST ===");
    const body: VerifyRequest = req.body;
    console.log("Network:", body.paymentRequirements?.network);
    console.log("Scheme:", body.paymentRequirements?.scheme);
    
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    
    console.log("Payment Requirements:", JSON.stringify(paymentRequirements, null, 2));
    console.log("Payment Payload:", JSON.stringify(paymentPayload, null, 2));

    // Use the correct client/signer based on the requested network
    // SVM verify requires a Signer because it signs & simulates the txn
    let client: Signer | ConnectedClient;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      console.log("Using EVM client");
      client = createConnectedClient(paymentRequirements.network);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      if (!SVM_PRIVATE_KEY) {
        throw new Error("SVM_PRIVATE_KEY not configured");
      }
      console.log("Using SVM signer");
      client = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else {
      throw new Error(`Unsupported network: ${paymentRequirements.network}`);
    }

    // Verify payment
    console.log("Calling verify...");
    const config = getX402Config(paymentRequirements.network);
    const valid = await verify(client, paymentPayload, paymentRequirements, config);
    console.log("Verify result:", JSON.stringify(valid, null, 2));
    console.log("=== VERIFY COMPLETE ===\n");
    
    res.json(valid);
  } catch (error) {
    console.error("Verify error:", error);
    res.status(400).json({ 
      error: "Invalid request",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Settle endpoint info
app.get("/settle", (req: Request, res: Response) => {
  res.json({
    endpoint: "/settle",
    description: "POST to settle x402 payments",
    method: "POST",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

// Settle payment
app.post("/settle", async (req: Request, res: Response) => {
  try {
    console.log("\n=== SETTLE REQUEST ===");
    const body: SettleRequest = req.body;
    console.log("Network:", body.paymentRequirements?.network);
    console.log("Scheme:", body.paymentRequirements?.scheme);
    
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    
    console.log("Payment Requirements:", JSON.stringify(paymentRequirements, null, 2));
    console.log("Payment Payload:", JSON.stringify(paymentPayload, null, 2));

    // Use the correct private key based on the requested network
    let signer: Signer;
    if (paymentRequirements.network === "base") {
      if (!BASE_MAINNET_PRIVATE_KEY) {
        throw new Error("BASE_MAINNET_PRIVATE_KEY not configured");
      }
      console.log("Using Base Mainnet signer");
      signer = await createSigner(paymentRequirements.network, BASE_MAINNET_PRIVATE_KEY);
    } else if (paymentRequirements.network === "base-sepolia") {
      if (!BASE_SEPOLIA_PRIVATE_KEY) {
        throw new Error("BASE_SEPOLIA_PRIVATE_KEY not configured");
      }
      console.log("Using Base Sepolia signer");
      signer = await createSigner(paymentRequirements.network, BASE_SEPOLIA_PRIVATE_KEY);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      if (!SVM_PRIVATE_KEY) {
        throw new Error("SVM_PRIVATE_KEY not configured");
      }
      console.log(`Using ${paymentRequirements.network} signer`);
      signer = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else {
      throw new Error(`Unsupported network: ${paymentRequirements.network}`);
    }

    // Settle payment
    console.log("Calling settle...");
    const config = getX402Config(paymentRequirements.network);
    const response = await settle(signer, paymentPayload, paymentRequirements, config);
    console.log("Settle result:", JSON.stringify(response, null, 2));
    console.log("=== SETTLE COMPLETE ===\n");
    
    res.json(response);
  } catch (error) {
    console.error("Settle error:", error);
    res.status(400).json({ 
      error: "Invalid request",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Amiko x402 Facilitator running at http://localhost:${PORT}`);
  console.log(`Supported networks:`);
  if (BASE_MAINNET_PRIVATE_KEY) console.log(`  - Base Mainnet (EVM)`);
  if (BASE_SEPOLIA_PRIVATE_KEY) console.log(`  - Base Sepolia (EVM)`);
  if (SVM_PRIVATE_KEY && SVM_MAINNET_RPC_URL) console.log(`  - Solana Mainnet (SVM)`);
  if (SVM_PRIVATE_KEY && SVM_DEVNET_RPC_URL) console.log(`  - Solana Devnet (SVM)`);
});
