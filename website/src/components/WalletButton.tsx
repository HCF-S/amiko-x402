'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export const WalletButton = () => {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = () => {
    setVisible(true);
  };

  const handleDisconnect = () => {
    disconnect();
    setIsOpen(false);
  };

  const handleMyAgent = () => {
    router.push('/my-agent');
    setIsOpen(false);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!publicKey) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap",
          "rounded-full text-sm font-semibold ring-offset-background",
          "transition-all focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "bg-[#2B7A8B] text-white hover:bg-[#236571]",
          "shadow-[0_4px_12px_rgba(43,122,139,0.4)]",
          "hover:shadow-[0_6px_16px_rgba(43,122,139,0.5)]",
          "h-10 px-6 py-2.5"
        )}
      >
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap",
          "rounded-full text-sm font-semibold ring-offset-background",
          "transition-all focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-2",
          "bg-[#2B7A8B] text-white hover:bg-[#236571]",
          "shadow-[0_4px_12px_rgba(43,122,139,0.4)]",
          "hover:shadow-[0_6px_16px_rgba(43,122,139,0.5)]",
          "h-10 px-6 py-2.5"
        )}
      >
        {formatAddress(publicKey.toBase58())}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={handleMyAgent}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            My Agent
          </button>
          <button
            onClick={handleDisconnect}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};
