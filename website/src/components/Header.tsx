'use client';

import Link from 'next/link';
import { WalletButton } from './WalletButton';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">T</span>
              </div>
              <h1 className="text-xl font-bold">Trustless</h1>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/agents" className="text-sm font-medium hover:text-primary transition-colors">
                Agents
              </Link>
              <Link href="/my-agent" className="text-sm font-medium hover:text-primary transition-colors">
                My Agent
              </Link>
            </nav>
          </div>
          
          <WalletButton />
        </div>
      </div>
    </header>
  );
};
