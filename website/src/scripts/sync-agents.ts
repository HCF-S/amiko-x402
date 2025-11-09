/**
 * Solana Program Event Listener
 * Listens to AgentRegistered and AgentAutoCreated events from the Trustless program
 * and syncs them to the PostgreSQL database
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { PrismaClient } from '@prisma/client';
import idl from '../lib/idl/trustless.json';
import { getAgentPDA } from '../lib/program';
import { matchInstructionsGetData } from '../lib/log-parser';

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
 * Fetch x402 payment info from endpoint
 */
async function fetchX402Info(url: string): Promise<any | null> {
  try {
    console.log(`  🔍 Checking x402 endpoint: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    // x402 endpoints should return 402 Payment Required without payment header
    if (response.status === 402) {
      const data = await response.json();
      
      // Validate x402 response format
      if (data.accepts && Array.isArray(data.accepts) && data.x402Version) {
        console.log(`  ✅ Valid x402 endpoint`);
        return data;
      } else {
        console.log(`  ⚠️  Invalid x402 response format`);
        return null;
      }
    } else {
      console.log(`  ⚠️  Expected 402 status, got ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Error fetching x402 info:`, error);
    return null;
  }
}

/**
 * Sync agent endpoints from metadata
 */
async function syncAgentEndpoints(agentWallet: string, metadataJson: any) {
  if (!metadataJson?.endpoints || !Array.isArray(metadataJson.endpoints)) {
    console.log(`  ℹ️  No endpoints in metadata`);
    
    // Delete all existing endpoints for this agent
    const deleted = await prisma.agentServices.deleteMany({
      where: { agent_wallet: agentWallet },
    });
    
    if (deleted.count > 0) {
      console.log(`  🗑️  Deleted ${deleted.count} endpoint(s)`);
    }
    
    return;
  }

  console.log(`  📡 Processing ${metadataJson.endpoints.length} endpoint(s)...`);

  const syncedUrls: string[] = [];

  for (const endpoint of metadataJson.endpoints) {
    if (!endpoint.url) {
      console.log(`  ⚠️  Skipping endpoint without URL`);
      continue;
    }

    try {
      // Fetch x402 payment info
      const x402Info = await fetchX402Info(endpoint.url);

      if (!x402Info) {
        console.log(`  ⚠️  Skipping non-x402 endpoint: ${endpoint.url}`);
        continue;
      }

      // Upsert agent service
      await prisma.agentServices.upsert({
        where: {
          agent_wallet_url: {
            agent_wallet: agentWallet,
            url: endpoint.url,
          },
        },
        create: {
          agent_wallet: agentWallet,
          url: endpoint.url,
          name: endpoint.name || null,
          description: endpoint.description || null,
          method: endpoint.method || null,
          metadata: x402Info as any,
        },
        update: {
          name: endpoint.name || null,
          description: endpoint.description || null,
          method: endpoint.method || null,
          metadata: x402Info as any,
          updated_at: new Date(),
        },
      });

      syncedUrls.push(endpoint.url);
      console.log(`  ✅ Synced endpoint: ${endpoint.url}`);
    } catch (error) {
      console.error(`  ❌ Error syncing endpoint ${endpoint.url}:`, error);
    }
  }

  // Delete endpoints that are no longer in metadata
  const deleted = await prisma.agentServices.deleteMany({
    where: {
      agent_wallet: agentWallet,
      url: {
        notIn: syncedUrls,
      },
    },
  });

  if (deleted.count > 0) {
    console.log(`  🗑️  Deleted ${deleted.count} outdated endpoint(s)`);
  }
}

/**
 * Fetch agent account and sync to database
 */
export async function syncAgentAccount(program: Program, agentPubkey: PublicKey) {
  const walletAddress = agentPubkey.toBase58();
  console.log(`🔍 Fetching agent account: ${walletAddress}`);

  try {
    const [agentPDA] = getAgentPDA(agentPubkey);
    
    // @ts-ignore - Anchor types don't include account names from IDL
    const accountData = await program.account.agentAccount.fetch(agentPDA);
    
    if (!accountData) {
      console.log(`⚠️  Agent account not found: ${walletAddress}`);
      return;
    }

    console.log(`📦 Account data:`, accountData);

    // Fetch metadata if URI exists
    let metadataJson = null;
    if (accountData.metadataUri) {
      metadataJson = await fetchMetadata(accountData.metadataUri);
    }

    // Get wallet address from account data
    const wallet = accountData.wallet.toBase58();

    // Upsert agent in database
    const agent = await prisma.agent.upsert({
      where: { wallet },
      create: {
        wallet,
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
        job_count: accountData.jobCount || 0,
        feedback_count: accountData.feedbackCount || 0,
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
        job_count: accountData.jobCount || 0,
        feedback_count: accountData.feedbackCount || 0,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Agent synced to database: ${wallet}`);

    // Sync endpoints from metadata
    if (metadataJson) {
      await syncAgentEndpoints(wallet, metadataJson);
    }
  } catch (error) {
    console.error(`❌ Error syncing agent ${walletAddress}:`, error);
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
      
      // Extract agent address and instruction from logs
      const result = matchInstructionsGetData(logs.logs, ['RegisterAgent', 'UpdateAgent', 'DeactivateAgent']);
      
      if (result) {
        const { pubkey: agentPubkey, instruction } = result;
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
