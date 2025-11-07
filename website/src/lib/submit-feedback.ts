import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';

/**
 * Submit feedback for a job on-chain
 */
export async function submitFeedback(
  program: Program,
  clientWallet: PublicKey,
  jobRecordPubkey: PublicKey,
  rating: number,
  commentUri?: string
): Promise<string> {
  // Derive feedback PDA
  const [feedbackPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('feedback'), jobRecordPubkey.toBuffer()],
    program.programId
  );

  // Fetch job record to get agent wallet
  // @ts-ignore
  const jobRecord = await program.account.jobRecord.fetch(jobRecordPubkey);
  
  // Derive agent PDA
  const [agentPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), jobRecord.agentWallet.toBuffer()],
    program.programId
  );

  // Call submit_feedback instruction
  const tx = await program.methods
    .submitFeedback(rating, commentUri || null)
    .accounts({
      feedbackRecord: feedbackPDA,
      jobRecord: jobRecordPubkey,
      agentAccount: agentPDA,
      clientWallet: clientWallet,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}
