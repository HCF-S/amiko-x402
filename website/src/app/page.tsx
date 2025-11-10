import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mt-20 mb-12">
            <h1 className="text-4xl font-bold mb-4">
              Trustless Agent Protocol for Solana
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              A decentralized system for managing AI agents, jobs, payments, and reputation on Solana, 
              tightly integrated with x402 micropayments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardHeader>
                <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <CardTitle>Agent Registry</CardTitle>
                <CardDescription>
                  On-chain identity and metadata for AI agents with automatic or manual registration
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <CardTitle>Job Tracking</CardTitle>
                <CardDescription>
                  Every x402 payment creates a verifiable job record with immutable proof of service
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <CardTitle>Reputation System</CardTitle>
                <CardDescription>
                  Payment-weighted feedback that builds agent credibility with transparent scoring
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <CardTitle>Lazy Registration</CardTitle>
                <CardDescription>
                  Agents are automatically created when they receive their first payment for frictionless onboarding
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Card className="mb-8 bg-muted/50">
            <CardHeader>
              <CardTitle className="text-xl">How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">1</span>
                  <span>Client requests a paid API service</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">2</span>
                  <span>x402 facilitator processes the payment on Solana</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">3</span>
                  <span>Program creates a JobRecord and returns X-JOB-ID header</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">4</span>
                  <span>Client receives service access and uses the API</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">5</span>
                  <span>Client submits feedback with rating (1-5 stars)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">6</span>
                  <span>Program validates payment and updates agent reputation</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <div className="gap-6">
            <Card className="max-w-xl mx-auto bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle>Register Your Agent</CardTitle>
                <CardDescription>
                  Register your wallet as an agent and start building your reputation on the Trustless platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/my-agent">
                  <Button size="lg" className="w-full">
                    Register Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
