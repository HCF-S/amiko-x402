'use client';

import { BaseWalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';

const WALLET_LABELS = {
  'change-wallet': 'Change wallet',
  connecting: 'Connecting ...',
  'copy-address': 'Copy address',
  copied: 'Copied',
  disconnect: 'Disconnect',
  'has-wallet': 'Connect Wallet',
  'no-wallet': 'Connect Wallet',
} as const;

export const WalletButton = () => {
  return (
    <BaseWalletMultiButton 
      labels={WALLET_LABELS}
      className={cn(
        "!inline-flex !items-center !justify-center !whitespace-nowrap",
        "!rounded-md !text-sm !font-medium !ring-offset-background",
        "!transition-colors focus-visible:!outline-none focus-visible:!ring-2",
        "focus-visible:!ring-ring focus-visible:!ring-offset-2",
        "disabled:!pointer-events-none disabled:!opacity-50",
        "!bg-primary !text-primary-foreground hover:!bg-primary/90",
        "!h-10 !px-4 !py-2"
      )}
    />
  );
};
