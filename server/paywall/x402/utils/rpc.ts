import {
  createSolanaRpc,
  devnet,
  mainnet,
  RpcDevnet,
  SolanaRpcApiDevnet,
  SolanaRpcApiMainnet,
  RpcMainnet,
} from "@solana/kit";

/**
 * Default public RPC endpoint for Solana devnet
 */
const DEVNET_RPC_URL = "https://api.devnet.solana.com";

/**
 * Default public RPC endpoint for Solana mainnet
 */
const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

/**
 * Gets the RPC URL from environment variable or uses default
 * 
 * @param network - The network to get the RPC URL for
 * @returns The RPC URL
 */
function getRpcUrl(network: string): string {
  // In browser, esbuild replaces process.env.SVM_RPC_URL with the actual string value
  // In Node.js, it reads from the actual environment
  const envRpcUrl = process.env.SVM_RPC_URL;
  
  // Use custom RPC if provided and not empty
  if (envRpcUrl && envRpcUrl !== "") {
    console.log(`[RPC] Using custom SVM_RPC_URL: ${envRpcUrl}`);
    return envRpcUrl;
  }
  
  // Fallback to default URLs
  let defaultUrl: string;
  if (network === "solana-devnet") {
    defaultUrl = DEVNET_RPC_URL;
  } else if (network === "solana") {
    defaultUrl = MAINNET_RPC_URL;
  } else {
    throw new Error(`Invalid network: ${network}`);
  }
  
  console.log(`[RPC] Using default URL for ${network}: ${defaultUrl}`);
  return defaultUrl;
}

/**
 * Creates a Solana RPC client for the devnet network.
 *
 * @param url - Optional URL of the devnet network.
 * @returns A Solana RPC client.
 */
export function createDevnetRpcClient(url?: string): RpcDevnet<SolanaRpcApiDevnet> {
  const rpcUrl = url || getRpcUrl("solana-devnet");
  return createSolanaRpc(devnet(rpcUrl)) as RpcDevnet<SolanaRpcApiDevnet>;
}

/**
 * Creates a Solana RPC client for the mainnet network.
 *
 * @param url - Optional URL of the mainnet network.
 * @returns A Solana RPC client.
 */
export function createMainnetRpcClient(url?: string): RpcMainnet<SolanaRpcApiMainnet> {
  const rpcUrl = url || getRpcUrl("solana");
  return createSolanaRpc(mainnet(rpcUrl)) as RpcMainnet<SolanaRpcApiMainnet>;
}

/**
 * Gets the RPC client for the given network.
 * Uses SVM_RPC_URL environment variable if set, otherwise falls back to default public endpoints.
 *
 * @param network - The network to get the RPC client for
 * @param url - Optional URL of the network. If not provided, uses SVM_RPC_URL env var or default URL.
 * @returns The RPC client for the given network
 */
export function getRpcClient(
  network: string,
  url?: string,
): RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet> {
  if (network === "solana-devnet") {
    return createDevnetRpcClient(url);
  } else if (network === "solana") {
    return createMainnetRpcClient(url);
  } else {
    throw new Error(`Invalid network: ${network}`);
  }
}
