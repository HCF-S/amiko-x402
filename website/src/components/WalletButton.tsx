'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';

export const WalletButton = () => {
  return (
    <WalletMultiButton 
      className={cn(
        "!bg-primary !text-primary-foreground hover:!bg-primary/90",
        "!rounded-lg !h-10 !px-6 !font-medium !transition-all",
        "!border-0 !shadow-sm"
      )}
    />
  );
};
