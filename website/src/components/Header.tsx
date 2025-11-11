'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WalletButton } from './WalletButton';

export const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
                <Link href="/docs" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Docs
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
              
              <WalletButton />
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <nav className="md:hidden mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-col gap-3">
                <Link
                  href="/agents"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                >
                  Agent
                </Link>
                <Link
                  href="/services"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                >
                  Services
                </Link>
                <Link
                  href="/jobs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                >
                  Jobs
                </Link>
                <Link
                  href="/feedbacks"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                >
                  Feedbacks
                </Link>
                <Link
                  href="/docs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                >
                  Docs
                </Link>
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};
