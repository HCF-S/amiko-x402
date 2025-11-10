'use client';

import Link from 'next/link';
import { WalletButton } from './WalletButton';

export const Header = () => {
  return (
    <header className="fixed top-6 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-[2rem] shadow-lg border border-gray-200/50 px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="size-8 bg-[#37768B] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">T</span>
                </div>
                <h1 className="text-lg font-bold">Trustless</h1>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/agents" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Agent
                </Link>
                <Link href="/services" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Services
                </Link>
                <Link href="/jobs" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Jobs
                </Link>
                <Link href="/feedbacks" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Feedbacks
                </Link>
                <Link href="/my-agent" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  My Agent
                </Link>
              </nav>
            </div>
            
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
};
