import { PaymentRequirements } from "./types.js";

export interface CrossmintConfig {
  apiKey: string;
  baseUrl: string;
  walletAddress: string;
}

export interface CrossmintTransferResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
  raw?: unknown;
}

export interface CrossmintSignatureRequest {
  type: "message" | "typed-data";
  message: string;
}

export interface CrossmintSignatureResponse {
  signature: string;
  publicKey: string;
}

export async function createCrossmintTransfer(
  config: CrossmintConfig,
  paymentRequirements: PaymentRequirements,
): Promise<CrossmintTransferResponse> {
  const { asset, payTo, maxAmountRequired, network } = paymentRequirements;

  let chain = network;
  if (chain.includes("solana")) {
    chain = "solana";
  } else if (chain.includes("base")) {
    chain = "base";
  }

  const tokenLocator = `${chain}:${asset}`;

  const decimals = 6;
  const decimalAmount = (Number(maxAmountRequired) / Math.pow(10, decimals)).toString();

  console.log(`[Crossmint] Token locator: ${tokenLocator}`);
  console.log(`[Crossmint] Decimal amount: ${decimalAmount}`);

  const url = `${config.baseUrl}/2025-06-09/wallets/${encodeURIComponent(
    config.walletAddress,
  )}/tokens/${encodeURIComponent(tokenLocator)}/transfers`;

  console.log(`[Crossmint] POST ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: payTo,
      amount: decimalAmount,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Crossmint] Transfer failed:", errorText);
    return {
      success: false,
      error: `Crossmint transfer failed: ${response.status} ${errorText}`,
    };
  }

  const result = await response.json() as {
    onChainTransaction?: { txHash?: string };
    id?: string;
    transactionId?: string;
    status?: string;
  };
  console.log("[Crossmint] Transfer result:", JSON.stringify(result, null, 2));

  const transactionId =
    result.onChainTransaction?.txHash || result.id || result.transactionId;

  return {
    success: true,
    transactionId,
    status: result.status,
    raw: result,
  };
}

export async function createCrossmintSignature(
  config: CrossmintConfig,
  request: CrossmintSignatureRequest,
): Promise<CrossmintSignatureResponse> {
  const url = `${config.baseUrl}/2025-06-09/wallets/${encodeURIComponent(
    config.walletAddress,
  )}/signatures`;

  console.log(`[Crossmint] POST ${url}`);

  const requestBody = {
    params: {
      type: request.type,
      message: request.message,
    },
  };

  console.log("[Crossmint] Request body:", JSON.stringify(requestBody, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Crossmint] Signature failed:", errorText);
    throw new Error(`Crossmint signature failed: ${response.status} ${errorText}`);
  }

  const result = await response.json() as { signature: string; publicKey: string };
  console.log("[Crossmint] Signature result:", JSON.stringify(result, null, 2));

  return {
    signature: result.signature,
    publicKey: result.publicKey,
  };
}
