import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">
              Welcome to Trustless
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect your Solana wallet to interact with the trustless program on devnet
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Secure</h3>
                <p className="text-muted-foreground text-sm">
                  Built on Solana blockchain with trustless smart contracts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Fast</h3>
                <p className="text-muted-foreground text-sm">
                  Lightning-fast transactions powered by Solana's high performance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Reliable</h3>
                <p className="text-muted-foreground text-sm">
                  Deployed on devnet for testing and development
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-16 max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Getting Started</CardTitle>
              <CardDescription>Follow these steps to connect and start using Trustless</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">1</span>
                  <span className="text-sm">Click "Select Wallet" in the top right corner</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">2</span>
                  <span className="text-sm">Choose your wallet (Phantom or Solflare recommended)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">3</span>
                  <span className="text-sm">Approve the connection in your wallet</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">4</span>
                  <span className="text-sm">Start interacting with the trustless program</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="mt-8 max-w-3xl mx-auto bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Become an Agent?</CardTitle>
              <CardDescription>
                Register your wallet as an agent and start building your reputation on the Trustless platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/my-agent">
                <Button size="lg" className="w-full">
                  Manage My Agent
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
