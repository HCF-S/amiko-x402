/**
 * Solana Program Event Listener for Jobs and Feedbacks
 * Listens to JobCreated and FeedbackSubmitted events from the Trustless program
 * and syncs them to the PostgreSQL database
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { PrismaClient } from '@prisma/client';
import idl from '../lib/idl/trustless.json';
import { matchInstructionsGetData } from '../lib/log-parser';

const prisma = new PrismaClient();

// Configuration
const PROGRAM_ID = new PublicKey(idl.address);
const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
const WSS_ENDPOINT = process.env.SOLANA_RPC_WSS || 'wss://api.devnet.solana.com';

/**
 * Sync a single job record to database
 */
async function syncJobRecord(program: Program, jobPubkey: PublicKey, transaction?: string) {
  const jobId = jobPubkey.toBase58();
  console.log(`🔍 Fetching job record: ${jobId}`);

  try {
    // Fetch job account from chain
    // @ts-ignore - Anchor types
    const jobAccount = await program.account.jobRecord.fetch(jobPubkey);

    // Convert BN and Pubkey to strings
    const jobData = {
      id: jobPubkey.toBase58(),
      client_wallet: jobAccount.clientWallet.toBase58(),
      agent_wallet: jobAccount.agentWallet.toBase58(),
      payment_amount: jobAccount.paymentAmount,
      created_at_chain: new Date((jobAccount.createdAt as BN).toNumber() * 1000),
      transaction: transaction || undefined,
    };

    // Upsert job record
    await prisma.jobRecord.upsert({
      where: { id: jobData.id },
      create: jobData,
      update: {
        ...jobData,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Synced job: ${jobData.id}`);
  } catch (error) {
    console.error(`❌ Error syncing job ${jobId}:`, error);
  }
}

/**
 * Sync a single feedback record to database
 */
async function syncFeedbackRecord(program: Program, feedbackPubkey: PublicKey, transaction?: string) {
  const feedbackId = feedbackPubkey.toBase58();
  console.log(`🔍 Fetching feedback record: ${feedbackId}`);

  try {
    // Fetch feedback account from chain
    // @ts-ignore - Anchor types
    const feedbackAccount = await program.account.feedbackRecord.fetch(feedbackPubkey);
    const jobId = feedbackAccount.jobId.toBase58();

    // Fetch the related job record to get client_wallet and agent_wallet
    const jobRecord = await prisma.jobRecord.findUnique({
      where: { id: jobId },
    });

    if (!jobRecord) {
      console.error(`❌ Job record not found: ${jobId}. Skipping feedback sync.`);
      return;
    }

    // Convert BN and Pubkey to strings, denormalize client/agent from JobRecord
    const feedbackData = {
      id: feedbackPubkey.toBase58(),
      job_id: jobId,
      client_wallet: jobRecord.client_wallet,
      agent_wallet: jobRecord.agent_wallet,
      rating: feedbackAccount.rating,
      comment_uri: feedbackAccount.commentUri || null,
      timestamp: new Date((feedbackAccount.timestamp as BN).toNumber() * 1000),
      transaction: transaction || undefined,
    };

    // Upsert feedback record
    await prisma.feedbackRecord.upsert({
      where: {
        id: feedbackData.id,
      },
      create: feedbackData,
      update: {
        ...feedbackData,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Synced feedback for job: ${feedbackData.job_id} (rating: ${feedbackData.rating})`);
  } catch (error) {
    console.error(`❌ Error syncing feedback ${feedbackId}:`, error);
  }
}


/**
 * Start listening to program events
 */
async function startEventListener() {
  console.log('🚀 Starting Jobs & Feedbacks Event Listener...');
  console.log(`📡 HTTP Endpoint: ${HTTP_ENDPOINT}`);
  console.log(`📡 WebSocket Endpoint: ${WSS_ENDPOINT}`);
  console.log(`📋 Program ID: ${PROGRAM_ID.toBase58()}`);

  const connection = new Connection(HTTP_ENDPOINT, {
    commitment: 'confirmed',
    wsEndpoint: WSS_ENDPOINT,
  });

  // Create program instance for fetching account data
  const wallet = new Wallet({
    publicKey: PublicKey.default,
    signTransaction: async () => { throw new Error('Read-only wallet'); },
    signAllTransactions: async () => { throw new Error('Read-only wallet'); },
  } as any);

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  const program = new Program(idl as any, provider);

  console.log('👂 Listening for all program logs...\n');

  // Subscribe to all logs from the program
  const subscriptionId = connection.onLogs(
    PROGRAM_ID,
    async (logs) => {
      console.log('📋 Program log received');
      console.log(`📝 Transaction: ${logs.signature}`);
      
      // Extract record from logs
      const result = matchInstructionsGetData(logs.logs, ['RegisterJob', 'SubmitFeedback']);
      
      if (!result) {
        return; // Skip if no instruction detected
      }

      const { pubkey, instruction } = result;

      // Handle RegisterJob instruction
      if (instruction === 'RegisterJob') {
        const emoji = '💼';
        console.log(`${emoji} Job registration detected: ${pubkey.toBase58()}`);
        await syncJobRecord(program, pubkey, logs.signature);
      }

      // Handle SubmitFeedback instruction
      if (instruction === 'SubmitFeedback') {
        const emoji = '⭐';
        console.log(`${emoji} Feedback submission detected: ${pubkey.toBase58()}`);
        await syncFeedbackRecord(program, pubkey, logs.signature);
      }
    },
    'confirmed'
  );

  console.log(`✅ Subscribed to program logs (ID: ${subscriptionId})\n`);

  // Keep the process running
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down event listener...');
    await connection.removeOnLogsListener(subscriptionId);
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Run the event listener
startEventListener().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
