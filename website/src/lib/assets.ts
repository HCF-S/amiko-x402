// Solana Mainnet (101)
export const USDC_SOLANA_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Solana Devnet (103)
export const USDC_SOLANA_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const USDC_DECIMALS = 6;

export const ASSET_CONFIG: Record<string, { name: string; symbol: string; decimals: number; network?: string }> = {
  [USDC_SOLANA_MAINNET]: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: USDC_DECIMALS,
    network: 'Mainnet',
  },
  [USDC_SOLANA_DEVNET]: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: USDC_DECIMALS,
    network: 'Devnet',
  },
};

/**
 * Get asset info by address
 */
export function getAssetInfo(address: string) {
  return ASSET_CONFIG[address] || {
    name: 'Unknown',
    symbol: address.slice(0, 8) + '...',
    decimals: 0,
  };
}

/**
 * Format amount with decimals
 */
export function formatAmount(amount: string | number, decimals: number): string {
  const numAmount = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  const formatted = numAmount / Math.pow(10, decimals);
  
  // Format with appropriate decimal places
  if (formatted < 0.01) {
    return formatted.toFixed(decimals);
  } else if (formatted < 1) {
    return formatted.toFixed(4);
  } else if (formatted < 1000) {
    return formatted.toFixed(2);
  } else {
    return formatted.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
}

/**
 * Format asset amount with symbol
 */
export function formatAssetAmount(amount: string | number, assetAddress: string): string {
  const asset = getAssetInfo(assetAddress);
  const formattedAmount = formatAmount(amount, asset.decimals);
  return `${formattedAmount} ${asset.symbol}`;
}
