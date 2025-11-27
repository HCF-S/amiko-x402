import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Program ID from lib.rs (original)
const PROGRAM_ID = new PublicKey("5Rp6HM2R1eT6cp3aMHesEDcaXMtCJY3fmRBB1RmoSic3");

async function findJobAccounts() {
  console.log("=== Finding Job Accounts ===\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Searching for job accounts...\n");

  try {
    const accounts = await provider.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          // Filter for JobRecord accounts (size = 8 discriminator + 76 data = 84 bytes)
          dataSize: 84,
        },
      ],
    });

    console.log(`Found ${accounts.length} job account(s)\n`);

    if (accounts.length === 0) {
      console.log("No job accounts found on devnet.");
      console.log("You need to register a job first before submitting feedback.");
      return;
    }

    for (const account of accounts) {
      console.log("Job Account:", account.pubkey.toString());

      const data = account.account.data;

      // Parse JobRecord
      // Skip 8-byte discriminator, then:
      // - client_wallet: Pubkey (32 bytes)
      // - agent_wallet: Pubkey (32 bytes)
      // - payment_amount: u32 (4 bytes)
      // - created_at: i64 (8 bytes)

      const clientWallet = new PublicKey(data.slice(8, 40));
      const agentWallet = new PublicKey(data.slice(40, 72));
      const paymentAmount = data.readUInt32LE(72);
      const createdAt = Number(data.readBigInt64LE(76));

      console.log("  Client:", clientWallet.toString());
      console.log("  Agent:", agentWallet.toString());
      console.log("  Payment:", paymentAmount, "tokens");
      console.log("  Created:", new Date(createdAt * 1000).toISOString());
      console.log("");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

findJobAccounts();
