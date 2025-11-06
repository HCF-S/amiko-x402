'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTrustlessProgram } from '@/hooks/useTrustlessProgram';
import { registerAgent } from '@/lib/program';

type InputMode = 'url' | 'json';

export default function RegisterAgentPage() {
  const { publicKey } = useWallet();
  const { program } = useTrustlessProgram();
  
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [metadata, setMetadata] = useState('{\n  "name": "",\n  "description": "",\n  "image": ""\n}');
  const [metadataUrl, setMetadataUrl] = useState('');
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

      setMetadataUrl(data.ipfsUrl);
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

    if (!metadataUrl) {
      setError('Please provide a metadata URL');
      return;
    }

    setError('');
    setSuccess('');
    setRegistering(true);

    try {
      console.log('=== Starting Agent Registration ===');
      console.log('Wallet:', publicKey.toBase58());
      console.log('Metadata URL:', metadataUrl);
      console.log('Program:', program.programId.toBase58());
      
      const signature = await registerAgent(program, publicKey, metadataUrl);
      
      console.log('✅ Registration successful!');
      console.log('Transaction signature:', signature);
      
      setSuccess(`Agent registered successfully! Transaction: ${signature}`);
      
      // Clear form
      setMetadata('{\n  "name": "",\n  "description": "",\n  "image": ""\n}');
      setMetadataUrl('');
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
                  Provide metadata URL or upload JSON to IPFS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <button
                    onClick={() => setInputMode('url')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      inputMode === 'url'
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                    }`}
                  >
                    Paste URL
                  </button>
                  <button
                    onClick={() => setInputMode('json')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      inputMode === 'json'
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                    }`}
                  >
                    Upload JSON
                  </button>
                </div>

                {inputMode === 'url' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={metadataUrl}
                      onChange={(e) => setMetadataUrl(e.target.value)}
                      placeholder="https://gateway.pinata.cloud/ipfs/..."
                      className="w-full p-4 bg-muted rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter an existing IPFS URL or other metadata URL (max 200 characters)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={metadata}
                      onChange={(e) => setMetadata(e.target.value)}
                      className="w-full h-64 p-4 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder='{\n  "name": "My Agent",\n  "description": "Agent description",\n  "image": "https://..."\n}'
                    />
                    
                    <Button
                      onClick={handleUpload}
                      disabled={uploading || !metadata.trim() || !publicKey}
                      className="w-full"
                    >
                      {uploading ? 'Uploading to IPFS...' : 'Upload to IPFS'}
                    </Button>
                  </div>
                )}

                {metadataUrl && (
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium mb-2">Metadata URL:</p>
                    <a
                      href={metadataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {metadataUrl}
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
              disabled={registering || !metadataUrl || !publicKey}
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
