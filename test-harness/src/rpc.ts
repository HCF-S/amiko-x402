import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";

const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

export function getRpcClient(
  network: string,
  customRpcUrl?: string,
): Rpc<SolanaRpcApi> {
  if (network === "solana-devnet") {
    return createSolanaRpc(customRpcUrl || DEFAULT_DEVNET_RPC_URL);
  } else if (network === "solana") {
    return createSolanaRpc(customRpcUrl || DEFAULT_MAINNET_RPC_URL);
  }
  throw new Error(`Unsupported network: ${network}`);
}

export function getRpcSubscriptions(network: string, customRpcUrl?: string) {
  const httpUrl = customRpcUrl || (network === "solana-devnet" ? DEFAULT_DEVNET_RPC_URL : DEFAULT_MAINNET_RPC_URL);
  const wsUrl = httpUrl.replace("https://", "wss://").replace("http://", "ws://");

  if (network === "solana-devnet") {
    return createSolanaRpcSubscriptions(wsUrl);
  } else if (network === "solana") {
    return createSolanaRpcSubscriptions(wsUrl);
  }
  throw new Error(`Unsupported network: ${network}`);
}
