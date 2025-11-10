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
        "!rounded-full !text-sm !font-semibold !ring-offset-background",
        "!transition-all focus-visible:!outline-none focus-visible:!ring-2",
        "focus-visible:!ring-ring focus-visible:!ring-offset-2",
        "disabled:!pointer-events-none disabled:!opacity-50",
        "!bg-[#2B7A8B] !text-white hover:!bg-[#236571]",
        "!shadow-[0_4px_12px_rgba(43,122,139,0.4)]",
        "hover:!shadow-[0_6px_16px_rgba(43,122,139,0.5)]",
        "!h-10 !px-6 !py-2.5"
      )}
    />
  );
};
