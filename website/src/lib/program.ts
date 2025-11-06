import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import idl from './idl/trustless.json';

// Program ID from the IDL
export const PROGRAM_ID = new PublicKey(idl.address);

// Type definitions based on IDL
export interface AgentAccount {
  agent: PublicKey;
  metadataUri: string;
  createdAt: number;
  active: boolean;
  autoCreated: boolean;
  totalWeightedRating: bigint;
  totalWeight: bigint;
  avgRating: number;
  lastUpdate: number;
}

export interface JobRecord {
  jobId: PublicKey;
  client: PublicKey;
  agent: PublicKey;
  paymentTx: PublicKey;
  paymentAmount: bigint;
  createdAt: number;
}

export interface FeedbackRecord {
  jobId: PublicKey;
  client: PublicKey;
  agent: PublicKey;
  rating: number;
  commentUri: string | null;
  proofOfPayment: PublicKey;
  paymentAmount: bigint;
  timestamp: number;
}

/**
 * Get the PDA for an agent account
 */
export function getAgentPDA(agentPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentPublicKey.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the PDA for a job record
 */
export function getJobPDA(paymentTx: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('job'), paymentTx.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Get the PDA for a feedback record
 */
export function getFeedbackPDA(jobId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('feedback'), jobId.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Create a program instance
 */
export function getTrustlessProgram(
  connection: Connection,
  provider: AnchorProvider
): Program {
  return new Program(idl as Idl, provider);
}

/**
 * Fetch an agent account
 */
export async function fetchAgentAccount(
  program: Program,
  agentPublicKey: PublicKey
): Promise<AgentAccount | null> {
  try {
    const [agentPDA] = getAgentPDA(agentPublicKey);
    const account = await program.account.agentAccount.fetch(agentPDA);
    return account as unknown as AgentAccount;
  } catch (error) {
    console.error('Error fetching agent account:', error);
    return null;
  }
}

/**
 * Fetch a job record
 */
export async function fetchJobRecord(
  program: Program,
  paymentTx: PublicKey
): Promise<JobRecord | null> {
  try {
    const [jobPDA] = getJobPDA(paymentTx);
    const account = await program.account.jobRecord.fetch(jobPDA);
    return account as unknown as JobRecord;
  } catch (error) {
    console.error('Error fetching job record:', error);
    return null;
  }
}

/**
 * Fetch a feedback record
 */
export async function fetchFeedbackRecord(
  program: Program,
  jobId: PublicKey
): Promise<FeedbackRecord | null> {
  try {
    const [feedbackPDA] = getFeedbackPDA(jobId);
    const account = await program.account.feedbackRecord.fetch(feedbackPDA);
    return account as unknown as FeedbackRecord;
  } catch (error) {
    console.error('Error fetching feedback record:', error);
    return null;
  }
}

/**
 * Register a new agent
 */
export async function registerAgent(
  program: Program,
  agentPublicKey: PublicKey,
  metadataUri: string
) {
  const [agentPDA] = getAgentPDA(agentPublicKey);
  
  return await program.methods
    .registerAgent(metadataUri)
    .accounts({
      agentAccount: agentPDA,
      agent: agentPublicKey,
    })
    .rpc();
}

/**
 * Update agent metadata
 */
export async function updateAgent(
  program: Program,
  agentPublicKey: PublicKey,
  metadataUri: string
) {
  const [agentPDA] = getAgentPDA(agentPublicKey);
  
  return await program.methods
    .updateAgent(metadataUri)
    .accounts({
      agentAccount: agentPDA,
      agent: agentPublicKey,
    })
    .rpc();
}

/**
 * Deactivate an agent
 */
export async function deactivateAgent(
  program: Program,
  agentPublicKey: PublicKey
) {
  const [agentPDA] = getAgentPDA(agentPublicKey);
  
  return await program.methods
    .deactivateAgent()
    .accounts({
      agentAccount: agentPDA,
      agent: agentPublicKey,
    })
    .rpc();
}
