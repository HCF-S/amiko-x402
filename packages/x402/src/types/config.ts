/**
 * Configuration options for Solana (SVM) RPC connections.
 */
export interface SvmConfig {
  /**
   * Custom RPC URL for Solana connections.
   * If not provided, defaults to public Solana RPC endpoints based on network.
   */
  rpcUrl?: string;
  /**
   * Trustless program ID for registering jobs on-chain.
   * If provided, register_job instruction will be added to payment transactions.
   */
  trustlessProgramId?: string;
}

/**
 * Configuration options for X402 client and facilitator operations.
 */
export interface X402Config {
  /** Configuration for Solana (SVM) operations */
  svmConfig?: SvmConfig;
  // Future: evmConfig?: EvmConfig for EVM-specific configurations
}
