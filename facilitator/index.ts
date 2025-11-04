import { config } from "dotenv";
import express, { Request, Response } from "express";
import { verify, settle } from "x402/facilitator";
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
} from "x402/types";
import { getFacilitatorPage } from "./page.js";

config();

const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || "";
const SVM_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY || "";
const SVM_RPC_URL = process.env.SVM_RPC_URL || "";
const PORT = process.env.PORT || 3000;
const USE_MAINNET = process.env.USE_MAINNET === "true";

if (!EVM_PRIVATE_KEY && !SVM_PRIVATE_KEY) {
  console.error("Missing required environment variables: EVM_PRIVATE_KEY or SVM_PRIVATE_KEY");
  process.exit(1);
}

// Create X402 config with custom RPC URL if provided
const x402Config: X402Config | undefined = SVM_RPC_URL
  ? { svmConfig: { rpcUrl: SVM_RPC_URL } }
  : undefined;

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
  const html = getFacilitatorPage({
    evmNetwork: EVM_PRIVATE_KEY ? (USE_MAINNET ? "Base Mainnet" : "Base Sepolia") : undefined,
    svmNetwork: SVM_PRIVATE_KEY ? (USE_MAINNET ? "Solana Mainnet" : "Solana Devnet") : undefined,
    useMainnet: USE_MAINNET,
  });
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Get supported payment kinds
app.get("/supported", async (req: Request, res: Response) => {
  try {
    const kinds: SupportedPaymentKind[] = [];

    // Base (EVM)
    if (EVM_PRIVATE_KEY) {
      const evmNetwork = USE_MAINNET ? "base" : "base-sepolia";
      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: evmNetwork,
      });
    }

    // Solana (SVM)
    if (SVM_PRIVATE_KEY) {
      const svmNetwork = USE_MAINNET ? "solana" : "solana-devnet";
      const signer = await createSigner(svmNetwork, SVM_PRIVATE_KEY);
      const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: svmNetwork,
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
    const body: VerifyRequest = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    // Use the correct client/signer based on the requested network
    // SVM verify requires a Signer because it signs & simulates the txn
    let client: Signer | ConnectedClient;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      client = createConnectedClient(paymentRequirements.network);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      if (!SVM_PRIVATE_KEY) {
        throw new Error("SVM_PRIVATE_KEY not configured");
      }
      client = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else {
      throw new Error(`Unsupported network: ${paymentRequirements.network}`);
    }

    // Verify payment
    const valid = await verify(client, paymentPayload, paymentRequirements, x402Config);
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
    const body: SettleRequest = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    // Use the correct private key based on the requested network
    let signer: Signer;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      if (!EVM_PRIVATE_KEY) {
        throw new Error("EVM_PRIVATE_KEY not configured");
      }
      signer = await createSigner(paymentRequirements.network, EVM_PRIVATE_KEY);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      if (!SVM_PRIVATE_KEY) {
        throw new Error("SVM_PRIVATE_KEY not configured");
      }
      signer = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else {
      throw new Error(`Unsupported network: ${paymentRequirements.network}`);
    }

    // Settle payment
    const response = await settle(signer, paymentPayload, paymentRequirements, x402Config);
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
  console.log(`Mode: ${USE_MAINNET ? "MAINNET" : "TESTNET"}`);
  console.log(`Supported networks:`);
  if (EVM_PRIVATE_KEY) console.log(`  - ${USE_MAINNET ? "Base" : "Base Sepolia"} (EVM)`);
  if (SVM_PRIVATE_KEY) console.log(`  - ${USE_MAINNET ? "Solana Mainnet" : "Solana Devnet"} (SVM)`);
});
