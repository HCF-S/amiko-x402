/**
 * Solana Program Event Listener for Jobs and Feedbacks
 * Listens to JobCreated and FeedbackSubmitted events from the Trustless program
 * and syncs them to the PostgreSQL database
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { PrismaClient } from '@prisma/client';
import idl from '../lib/idl/trustless.json';

const prisma = new PrismaClient();

// Configuration
const PROGRAM_ID = new PublicKey(idl.address);
const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
const WSS_ENDPOINT = process.env.SOLANA_RPC_WSS || 'wss://api.devnet.solana.com';

/**
 * Sync a single job record to database
 */
async function syncJobRecord(program: Program, jobPubkey: PublicKey) {
  const jobId = jobPubkey.toBase58();
  console.log(`🔍 Fetching job record: ${jobId}`);

  try {
    // Fetch job account from chain
    // @ts-ignore - Anchor types
    const jobAccount = await program.account.jobRecord.fetch(jobPubkey);

    // Convert BN and Pubkey to strings
    const jobData = {
      id: jobAccount.jobId.toBase58(),
      client_wallet: jobAccount.clientWallet.toBase58(),
      agent_wallet: jobAccount.agentWallet.toBase58(),
      payment_tx: jobAccount.paymentTx.toBase58(),
      payment_amount: jobAccount.paymentAmount.toString(),
      created_at_chain: new Date((jobAccount.createdAt as BN).toNumber() * 1000),
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
async function syncFeedbackRecord(program: Program, feedbackPubkey: PublicKey) {
  const feedbackId = feedbackPubkey.toBase58();
  console.log(`🔍 Fetching feedback record: ${feedbackId}`);

  try {
    // Fetch feedback account from chain
    // @ts-ignore - Anchor types
    const feedbackAccount = await program.account.feedbackRecord.fetch(feedbackPubkey);

    // Convert BN and Pubkey to strings
    const feedbackData = {
      id: feedbackAccount.feedbackId.toBase58(),
      job_id: feedbackAccount.jobId.toBase58(),
      client_wallet: feedbackAccount.clientWallet.toBase58(),
      agent_wallet: feedbackAccount.agentWallet.toBase58(),
      rating: feedbackAccount.rating,
      comment_uri: feedbackAccount.commentUri || null,
      proof_of_payment: feedbackAccount.proofOfPayment.toBase58(),
      payment_amount: feedbackAccount.paymentAmount.toString(),
      timestamp: new Date((feedbackAccount.timestamp as BN).toNumber() * 1000),
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
 * Detect instruction type from logs
 */
function detectInstructionType(logs: string[]): string | null {
  for (const log of logs) {
    if (log.includes('Program log: Instruction:')) {
      const instruction = log.split('Program log: Instruction:')[1]?.trim();
      return instruction;
    }
  }
  return null;
}

/**
 * Extract account address from instruction invocation logs
 */
function extractAccountFromLogs(logs: string[], instruction: string): PublicKey | null {
  try {
    // Look for the program invocation with account addresses
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      
      // Find the invoke line for our program
      if (log.includes(`Program ${PROGRAM_ID.toBase58()} invoke`)) {
        // The next few lines contain account addresses
        // Format: "Program log: Instruction: RegisterJob" or "Program log: Instruction: SubmitFeedback"
        // Look for account addresses in subsequent lines
        
        // Try to find account addresses in the invoke context
        for (let j = i; j < Math.min(i + 10, logs.length); j++) {
          const contextLog = logs[j];
          
          // Look for base58 encoded addresses (32-44 characters)
          const matches = contextLog.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
          if (matches && matches.length > 0) {
            // Filter out the program ID itself
            const accounts = matches
              .filter(addr => addr !== PROGRAM_ID.toBase58())
              .map(addr => {
                try {
                  return new PublicKey(addr);
                } catch {
                  return null;
                }
              })
              .filter((pk): pk is PublicKey => pk !== null);
            
            if (accounts.length > 0) {
              // For RegisterJob: job_record should be one of the first accounts
              // For SubmitFeedback: feedback_record should be one of the first accounts
              console.log(`🔍 Found ${accounts.length} account(s) in instruction`);
              
              // Return the first account (should be job_record or feedback_record)
              const accountPubkey = accounts[0];
              console.log(`🔍 Extracted account: ${accountPubkey.toBase58()}`);
              return accountPubkey;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting account from logs:', error);
  }
  return null;
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
      
      // Detect instruction type
      const instruction = detectInstructionType(logs.logs);
      
      if (!instruction) {
        return; // Skip if no instruction detected
      }

      console.log(`📝 Transaction: ${logs.signature}`);
      console.log(`📋 Instruction: ${instruction}`);

      // Handle RegisterJob instruction
      if (instruction === 'RegisterJob') {
        const jobPubkey = extractAccountFromLogs(logs.logs, instruction);
        if (jobPubkey) {
          const emoji = '💼';
          console.log(`${emoji} Job registration detected: ${jobPubkey.toBase58()}`);
          await syncJobRecord(program, jobPubkey);
        }
      }

      // Handle SubmitFeedback instruction
      if (instruction === 'SubmitFeedback') {
        const feedbackPubkey = extractAccountFromLogs(logs.logs, instruction);
        if (feedbackPubkey) {
          const emoji = '⭐';
          console.log(`${emoji} Feedback submission detected: ${feedbackPubkey.toBase58()}`);
          await syncFeedbackRecord(program, feedbackPubkey);
        }
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
