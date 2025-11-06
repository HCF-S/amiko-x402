'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTrustlessProgram } from '@/hooks/useTrustlessProgram';
import { registerAgent } from '@/lib/program';

export default function RegisterAgentPage() {
  const { publicKey } = useWallet();
  const { program } = useTrustlessProgram();
  
  const [metadata, setMetadata] = useState('{\n  "name": "",\n  "description": "",\n  "image": ""\n}');
  const [ipfsUrl, setIpfsUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpload = async () => {
    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const response = await fetch('/api/upload-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setIpfsUrl(data.ipfsUrl);
      setSuccess(`Uploaded to IPFS: ${data.ipfsHash}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const handleRegister = async () => {
    if (!program || !publicKey) {
      setError('Please connect your wallet');
      return;
    }

    if (!ipfsUrl) {
      setError('Please upload metadata first');
      return;
    }

    setError('');
    setSuccess('');
    setRegistering(true);

    try {
      console.log('=== Starting Agent Registration ===');
      console.log('Wallet:', publicKey.toBase58());
      console.log('IPFS URL:', ipfsUrl);
      console.log('Program:', program.programId.toBase58());
      
      const signature = await registerAgent(program, publicKey, ipfsUrl);
      
      console.log('✅ Registration successful!');
      console.log('Transaction signature:', signature);
      
      setSuccess(`Agent registered successfully! Transaction: ${signature}`);
      
      // Clear form
      setMetadata('{\n  "name": "",\n  "description": "",\n  "image": ""\n}');
      setIpfsUrl('');
    } catch (err: any) {
      console.error('❌ Registration error:', err);
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Error logs:', err.logs);
      console.error('Full error:', JSON.stringify(err, null, 2));
      
      setError(err instanceof Error ? err.message : 'Failed to register agent');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Register Agent</h1>
            <p className="text-muted-foreground">
              Register your wallet as an agent on the Trustless platform
            </p>
          </div>

          {!publicKey && (
            <Card className="mb-6 border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive font-medium">
                  Please connect your wallet to register an agent
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Address</CardTitle>
                <CardDescription>
                  This wallet address will be registered as the agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">
                  {publicKey ? publicKey.toBase58() : 'Not connected'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Metadata</CardTitle>
                <CardDescription>
                  Enter your agent metadata in JSON format
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  className="w-full h-64 p-4 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder='{\n  "name": "My Agent",\n  "description": "Agent description",\n  "image": "https://..."\n}'
                />
                
                <div className="flex gap-3">
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || !metadata.trim() || !publicKey}
                    className="flex-1"
                  >
                    {uploading ? 'Uploading...' : 'Upload to IPFS'}
                  </Button>
                </div>

                {ipfsUrl && (
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium mb-2">IPFS URL:</p>
                    <a
                      href={ipfsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {ipfsUrl}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {error && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <p className="text-destructive text-sm">{error}</p>
                </CardContent>
              </Card>
            )}

            {success && (
              <Card className="border-primary">
                <CardContent className="pt-6">
                  <p className="text-primary text-sm">{success}</p>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleRegister}
              disabled={registering || !ipfsUrl || !publicKey}
              size="lg"
              className="w-full"
            >
              {registering ? 'Registering...' : 'Register Agent'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
