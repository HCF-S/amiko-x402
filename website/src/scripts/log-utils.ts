/**
 * Solana Program Log Parsing Utilities
 * Helper functions for extracting data from Solana transaction logs
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Extract a pubkey from a log message that matches a specific pattern
 * @param logs Array of log strings from transaction
 * @param messagePrefix The prefix to match (e.g., "Agent Account Auto Created:", "Job Registered:")
 * @returns PublicKey if found, null otherwise
 */
export function extractPubkeyFromLog(
  logs: string[],
  messagePrefix: string
): PublicKey | null {
  try {
    // Find the log message that contains the prefix
    const matchingLog = logs.find(log => log.includes(messagePrefix));
    
    if (!matchingLog) {
      return null;
    }

    // Extract the pubkey after the prefix
    // Format: "Program log: <messagePrefix> <pubkey>"
    const regex = new RegExp(`${messagePrefix}\\s+([A-Za-z0-9]+)`);
    const match = matchingLog.match(regex);
    
    if (match && match[1]) {
      const pubkey = new PublicKey(match[1]);
      console.log(`🔍 Extracted pubkey from "${messagePrefix}": ${pubkey.toBase58()}`);
      return pubkey;
    }
  } catch (error) {
    console.error(`Error extracting pubkey from log with prefix "${messagePrefix}":`, error);
  }
  
  return null;
}

/**
 * Match instruction logs and extract Program data from following lines
 * @param logs Array of log strings from transaction
 * @param instructions Array of instruction names to match (e.g., ['RegisterAgent', 'UpdateAgent'])
 * @returns Object with matched instruction name and extracted pubkey, or null if not found
 */
export function matchInstructionsGetData(
  logs: string[],
  instructions: string[]
): { instruction: string; pubkey: PublicKey } | null {
  try {
    // Find instruction log index
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      
      // Check if this log matches any of the target instructions
      for (const instruction of instructions) {
        if (log.includes(`Program log: Instruction: ${instruction}`)) {
          console.log(`📝 Found instruction: ${instruction}`);
          
          // Look for "Program data:" in the following lines
          for (let j = i + 1; j < logs.length; j++) {
            const followingLog = logs[j];
            
            if (followingLog.includes('Program data:')) {
              const base64Data = followingLog.split('Program data: ')[1]?.trim();
              if (!base64Data) continue;

              try {
                // Decode base64
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Event structure: 8 bytes discriminator + 32 bytes pubkey + rest
                // Skip the first 8 bytes (event discriminator) and read the next 32 bytes
                if (buffer.length >= 40) {
                  const pubkeyBytes = buffer.slice(8, 40);
                  const pubkey = new PublicKey(pubkeyBytes);
                  
                  console.log(`🔍 Extracted pubkey from event data: ${pubkey.toBase58()}`);
                  return { instruction, pubkey };
                }
              } catch (error) {
                console.error('Error decoding Program data:', error);
                continue;
              }
            }
            
            // Stop searching if we hit another instruction or program invocation
            if (followingLog.includes('Program log: Instruction:') || 
                followingLog.includes('Program invoke')) {
              break;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error matching instructions and extracting data:', error);
  }
  return null;
}
