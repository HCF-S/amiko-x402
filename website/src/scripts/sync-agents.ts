/**
 * Solana Program Event Listener
 * Listens to AgentRegistered and AgentAutoCreated events from the Trustless program
 * and syncs them to the PostgreSQL database
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { PrismaClient } from '@prisma/client';
import idl from '../../../trustless/target/idl/trustless.json';
import { getAgentPDA } from '../lib/program';

const prisma = new PrismaClient();

// Configuration
const PROGRAM_ID = new PublicKey(idl.address);
const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
const WSS_ENDPOINT = process.env.SOLANA_RPC_WSS || 'wss://api.devnet.solana.com';

/**
 * Fetch metadata JSON from URI
 */
async function fetchMetadata(uri: string): Promise<any> {
  try {
    const response = await fetch(uri);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error fetching metadata:', error);
  }
  return null;
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
 * Extract agent address from logs
 */
function extractAgentFromLogs(logs: string[]): { agentPubkey: PublicKey; instruction: string | null } | null {
  try {
    // Detect instruction type
    const instruction = detectInstructionType(logs);
    
    // Look for "Program data:" which contains the event data
    for (const log of logs) {
      if (log.includes('Program data:')) {
        const base64Data = log.split('Program data: ')[1]?.trim();
        if (!base64Data) continue;

        try {
          // Decode base64
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Event structure: 8 bytes discriminator + 32 bytes agent pubkey + rest
          // Skip the first 8 bytes (event discriminator) and read the next 32 bytes (agent pubkey)
          if (buffer.length >= 40) {
            const agentBytes = buffer.slice(8, 40);
            const agentPubkey = new PublicKey(agentBytes);
            
            console.log(`🔍 Extracted agent from event data: ${agentPubkey.toBase58()}`);
            if (instruction) {
              console.log(`📝 Instruction: ${instruction}`);
            }
            return { agentPubkey, instruction };
          }
        } catch (error) {
          console.error('Error decoding Program data:', error);
          continue;
        }
      }
    }
    
    // Fallback: try to find any valid base58 pubkey in logs
    for (const log of logs) {
      const pubkeyMatch = log.match(/[1-9A-HJ-NP-Za-km-z]{43,44}/);
      if (pubkeyMatch) {
        try {
          const pubkey = new PublicKey(pubkeyMatch[0]);
          if (PublicKey.isOnCurve(pubkey.toBytes())) {
            console.log(`🔍 Extracted agent from log text: ${pubkey.toBase58()}`);
            if (instruction) {
              console.log(`📝 Instruction: ${instruction}`);
            }
            return { agentPubkey: pubkey, instruction };
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Error extracting agent from logs:', error);
  }
  return null;
}

/**
 * Fetch agent account and sync to database
 */
async function syncAgentAccount(program: Program, agentPubkey: PublicKey) {
  const address = agentPubkey.toBase58();
  console.log(`🔍 Fetching agent account: ${address}`);

  try {
    const [agentPDA] = getAgentPDA(agentPubkey);
    
    // @ts-ignore - Anchor types don't include account names from IDL
    const accountData = await program.account.agentAccount.fetch(agentPDA);
    
    if (!accountData) {
      console.log(`⚠️  Agent account not found: ${address}`);
      return;
    }

    console.log(`📦 Account data:`, accountData);

    // Fetch metadata if URI exists
    let metadataJson = null;
    if (accountData.metadataUri) {
      metadataJson = await fetchMetadata(accountData.metadataUri);
    }

    // Upsert agent in database
    await prisma.agent.upsert({
      where: { address },
      create: {
        address,
        metadata_uri: accountData.metadataUri || null,
        metadata_json: metadataJson,
        name: metadataJson?.name,
        description: metadataJson?.description,
        active: accountData.active,
        auto_created: accountData.autoCreated,
        total_weighted_rating: accountData.totalWeightedRating.toString(),
        total_weight: accountData.totalWeight.toString(),
        avg_rating: accountData.avgRating,
        last_update: accountData.lastUpdate ? new Date(accountData.lastUpdate * 1000) : null,
      },
      update: {
        metadata_uri: accountData.metadataUri || null,
        metadata_json: metadataJson,
        name: metadataJson?.name,
        description: metadataJson?.description,
        active: accountData.active,
        total_weighted_rating: accountData.totalWeightedRating.toString(),
        total_weight: accountData.totalWeight.toString(),
        avg_rating: accountData.avgRating,
        last_update: accountData.lastUpdate ? new Date(accountData.lastUpdate * 1000) : null,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Agent synced to database: ${address}`);
  } catch (error) {
    console.error(`❌ Error syncing agent account:`, error);
  }
}

/**
 * Start listening to program events
 */
async function startEventListener() {
  console.log('🚀 Starting Trustless Program Event Listener...');
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
      console.log('logs', logs);
      
      // Extract agent address and instruction from logs
      const result = extractAgentFromLogs(logs.logs);
      
      if (result) {
        const { agentPubkey, instruction } = result;
        const emoji = instruction === 'RegisterAgent' ? '📝' : 
                     instruction === 'UpdateAgent' ? '🔄' : 
                     instruction === 'DeactivateAgent' ? '🚫' : '🔔';
        
        console.log(`${emoji} Agent activity detected: ${agentPubkey.toBase58()}`);
        
        // Fetch and sync the full account data
        await syncAgentAccount(program, agentPubkey);
      } else {
        console.log('⚠️  Could not extract agent address from logs');
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

// Start the listener
startEventListener().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
