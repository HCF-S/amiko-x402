import { config } from "dotenv";
import express from "express";

config();

const PORT = process.env.MOCK_PLATFORM_PORT || 4114;
const CROSSMINT_WALLET_ADDRESS = process.env.CROSSMINT_WALLET_ADDRESS || "";

const app = express();
app.use(express.json());

// Mock wallet lookup endpoint
app.get("/public/wallets/:address", (req, res) => {
  const { address } = req.params;

  console.log(`[mock-platform] Wallet lookup: ${address}`);

  // Check if this is the known Crossmint test wallet
  const isCrossmint = address === CROSSMINT_WALLET_ADDRESS;

  const response = {
    found: true,
    isCrossmint,
    custodian: isCrossmint ? "crossmint" : null,
    owner: isCrossmint ? "test-user" : null,
    walletAddress: address,
    chainType: "solana",
    chain: "solana-devnet",
  };

  console.log(`[mock-platform] Response:`, response);
  res.json(response);
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "mock-platform-api",
    crossmintWallet: CROSSMINT_WALLET_ADDRESS,
  });
});

app.listen(PORT, () => {
  console.log(`\n🔧 Mock Platform API running at http://localhost:${PORT}`);
  console.log(`   Crossmint wallet: ${CROSSMINT_WALLET_ADDRESS || "(not set)"}`);
  console.log(`\n   This mock returns isCrossmint=true for the CROSSMINT_WALLET_ADDRESS\n`);
});
