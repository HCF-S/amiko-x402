/**
 * Solana Program Event Listener
 * Listens to AgentRegistered and AgentAutoCreated events from the Trustless program
 * and syncs them to the PostgreSQL database
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { PrismaClient } from '@prisma/client';
import idl from '../../../trustless/target/idl/trustless.json';

const prisma = new PrismaClient();

// Configuration
const PROGRAM_ID = new PublicKey(idl.address);
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

// Event types from the program
interface AgentRegisteredEvent {
  agent: PublicKey;
  metadataUri: string;
}

interface AgentAutoCreatedEvent {
  agent: PublicKey;
}

interface AgentUpdatedEvent {
  agent: PublicKey;
  metadataUri: string;
}

interface AgentDeactivatedEvent {
  agent: PublicKey;
}

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
 * Handle AgentRegistered event
 */
async function handleAgentRegistered(event: AgentRegisteredEvent) {
  const address = event.agent.toBase58();
  console.log(`📝 AgentRegistered: ${address}`);

  try {
    // Fetch metadata JSON
    const metadataJson = await fetchMetadata(event.metadataUri);
    
    // Upsert agent in database
    await prisma.agent.upsert({
      where: { address },
      create: {
        address,
        metadata_uri: event.metadataUri,
        metadata_json: metadataJson,
        name: metadataJson?.name,
        description: metadataJson?.description,
        active: true,
        auto_created: false,
        total_weighted_rating: new BN(0).toString(),
        total_weight: new BN(0).toString(),
        avg_rating: 0,
      },
      update: {
        metadata_uri: event.metadataUri,
        metadata_json: metadataJson,
        name: metadataJson?.name,
        description: metadataJson?.description,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Agent registered in database: ${address}`);
  } catch (error) {
    console.error(`❌ Error handling AgentRegistered:`, error);
  }
}

/**
 * Handle AgentAutoCreated event
 */
async function handleAgentAutoCreated(event: AgentAutoCreatedEvent) {
  const address = event.agent.toBase58();
  console.log(`🤖 AgentAutoCreated: ${address}`);

  try {
    // Create agent with minimal data (lazy registration)
    await prisma.agent.upsert({
      where: { address },
      create: {
        address,
        active: true,
        auto_created: true,
        total_weighted_rating: new BN(0).toString(),
        total_weight: new BN(0).toString(),
        avg_rating: 0,
      },
      update: {
        // Don't overwrite existing data if agent already exists
        updated_at: new Date(),
      },
    });

    console.log(`✅ Auto-created agent in database: ${address}`);
  } catch (error) {
    console.error(`❌ Error handling AgentAutoCreated:`, error);
  }
}

/**
 * Handle AgentUpdated event
 */
async function handleAgentUpdated(event: AgentUpdatedEvent) {
  const address = event.agent.toBase58();
  console.log(`🔄 AgentUpdated: ${address}`);

  try {
    // Fetch updated metadata
    const metadataJson = await fetchMetadata(event.metadataUri);
    
    await prisma.agent.update({
      where: { address },
      data: {
        metadata_uri: event.metadataUri,
        metadata_json: metadataJson,
        name: metadataJson?.name,
        description: metadataJson?.description,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Agent updated in database: ${address}`);
  } catch (error) {
    console.error(`❌ Error handling AgentUpdated:`, error);
  }
}

/**
 * Handle AgentDeactivated event
 */
async function handleAgentDeactivated(event: AgentDeactivatedEvent) {
  const address = event.agent.toBase58();
  console.log(`🚫 AgentDeactivated: ${address}`);

  try {
    await prisma.agent.update({
      where: { address },
      data: {
        active: false,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Agent deactivated in database: ${address}`);
  } catch (error) {
    console.error(`❌ Error handling AgentDeactivated:`, error);
  }
}

/**
 * Start listening to program events
 */
async function startEventListener() {
  console.log('🚀 Starting Trustless Program Event Listener...');
  console.log(`📡 RPC Endpoint: ${RPC_ENDPOINT}`);
  console.log(`📋 Program ID: ${PROGRAM_ID.toBase58()}`);

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  
  // Create a dummy wallet for the provider (read-only operations)
  const wallet = new Wallet({
    publicKey: PublicKey.default,
    signTransaction: async () => { throw new Error('Read-only wallet'); },
    signAllTransactions: async () => { throw new Error('Read-only wallet'); },
  } as any);

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  const program = new Program(idl as any, provider);

  console.log('👂 Listening for events...\n');

  // Listen to AgentRegistered events
  program.addEventListener('AgentRegistered', (event: any) => {
    handleAgentRegistered({
      agent: event.agent,
      metadataUri: event.metadataUri,
    });
  });

  // Listen to AgentAutoCreated events
  program.addEventListener('AgentAutoCreated', (event: any) => {
    handleAgentAutoCreated({
      agent: event.agent,
    });
  });

  // Listen to AgentUpdated events
  program.addEventListener('AgentUpdated', (event: any) => {
    handleAgentUpdated({
      agent: event.agent,
      metadataUri: event.metadataUri,
    });
  });

  // Listen to AgentDeactivated events
  program.addEventListener('AgentDeactivated', (event: any) => {
    handleAgentDeactivated({
      agent: event.agent,
    });
  });

  // Keep the process running
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down event listener...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Start the listener
startEventListener().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
