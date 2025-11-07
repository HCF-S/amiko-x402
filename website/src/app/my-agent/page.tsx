'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTrustlessProgram } from '@/hooks/useTrustlessProgram';
import { registerAgent, updateAgent, getAgentPDA, type AgentAccount } from '@/lib/program';

type InputMode = 'url' | 'json';
type PageMode = 'loading' | 'register' | 'update';

export default function MyAgentPage() {
  const { publicKey } = useWallet();
  const { program, connection } = useTrustlessProgram();
  
  const DEFAULT_METADATA = `{
  "name": "Agent Name",
  "description": "",
  "image": "",
  "endpoints": [
    {
      "name": "",
      "description": "",
      "url": "https://...",
      "method": "GET"
    }
  ]
}`;

  const [pageMode, setPageMode] = useState<PageMode>('loading');
  const [agentAccount, setAgentAccount] = useState<AgentAccount | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [metadata, setMetadata] = useState(DEFAULT_METADATA);
  const [originalMetadata, setOriginalMetadata] = useState(DEFAULT_METADATA);
  const [metadataUrl, setMetadataUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ message: string; link?: string } | null>(null);

  // Validate metadata format
  const validateMetadata = (metadataString: string): { valid: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(metadataString);
      
      // Check required fields
      if (!parsed.name || typeof parsed.name !== 'string') {
        return { valid: false, error: 'Missing or invalid "name" field' };
      }
      
      if (typeof parsed.description !== 'string') {
        return { valid: false, error: 'Missing or invalid "description" field' };
      }
      
      // Check endpoints array
      if (!Array.isArray(parsed.endpoints)) {
        return { valid: false, error: 'Missing or invalid "endpoints" array' };
      }
      
      // Validate each endpoint
      for (let i = 0; i < parsed.endpoints.length; i++) {
        const endpoint = parsed.endpoints[i];
        
        if (typeof endpoint.name !== 'string') {
          return { valid: false, error: `Endpoint ${i + 1}: missing or invalid "name"` };
        }
        
        if (typeof endpoint.description !== 'string') {
          return { valid: false, error: `Endpoint ${i + 1}: missing or invalid "description"` };
        }
        
        if (typeof endpoint.url !== 'string' || !endpoint.url.startsWith('http')) {
          return { valid: false, error: `Endpoint ${i + 1}: invalid "url" (must start with http/https)` };
        }
        
        if (typeof endpoint.method !== 'string' || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(endpoint.method)) {
          return { valid: false, error: `Endpoint ${i + 1}: invalid "method" (must be GET, POST, PUT, DELETE, or PATCH)` };
        }
      }
      
      return { valid: true };
    } catch (err) {
      return { valid: false, error: 'Invalid JSON format' };
    }
  };

  // Check if agent account exists
  useEffect(() => {
    async function checkAgentAccount() {
      if (!publicKey || !connection) {
        setPageMode('register');
        return;
      }

      try {
        setPageMode('loading');
        const [agentPDA] = getAgentPDA(publicKey);
        
        console.log('Checking agent account:', agentPDA.toBase58());
        
        const accountInfo = await connection.getAccountInfo(agentPDA);
        
        if (accountInfo) {
          // Account exists, fetch the data
          if (program) {
            try {
              // @ts-ignore - Anchor types don't include account names from IDL
              const account = await program.account.agentAccount.fetch(agentPDA);
              console.log('Agent account found:', account);
              setAgentAccount(account as AgentAccount);
              setMetadataUrl(account.metadataUri);
              
              // Fetch metadata JSON from URL
              try {
                console.log('Fetching metadata from:', account.metadataUri);
                const metadataResponse = await fetch(account.metadataUri);
                if (metadataResponse.ok) {
                  const metadataJson = await metadataResponse.json();
                  const metadataString = JSON.stringify(metadataJson, null, 2);
                  setMetadata(metadataString);
                  setOriginalMetadata(metadataString);
                  console.log('Metadata loaded:', metadataJson);
                } else {
                  console.warn('Failed to fetch metadata:', metadataResponse.status);
                }
              } catch (metadataErr) {
                console.error('Error fetching metadata JSON:', metadataErr);
                // Continue anyway, user can still update the URL
              }
              
              setPageMode('update');
            } catch (err) {
              console.error('Error fetching agent account:', err);
              setPageMode('register');
            }
          } else {
            setPageMode('register');
          }
        } else {
          console.log('Agent account does not exist');
          setPageMode('register');
        }
      } catch (err) {
        console.error('Error checking agent account:', err);
        setPageMode('register');
      }
    }

    checkAgentAccount();
  }, [publicKey, connection, program]);

  const handleUpload = async () => {
    setError('');
    setSuccess(null);

    // Validate metadata before uploading
    const validation = validateMetadata(metadata);
    if (!validation.valid) {
      setError(`Validation error: ${validation.error}`);
      return;
    }

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
      setOriginalMetadata(metadata); // Update original after successful upload
      setSuccess({ message: `Uploaded to IPFS: ${data.ipfsHash}` });
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
    setSuccess(null);
    setUpdating(true);

    try {
      console.log('=== Starting Agent Registration ===');
      console.log('Wallet:', publicKey.toBase58());
      console.log('Metadata URL:', metadataUrl);
      console.log('Program:', program.programId.toBase58());
      
      const signature = await registerAgent(program, publicKey, metadataUrl);
      
      console.log('✅ Registration successful!');
      console.log('Transaction signature:', signature);
      
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
      const explorerUrl = `https://explorer.solana.com/tx/${signature}${clusterParam}`;
      setSuccess({ 
        message: 'Agent registered successfully!', 
        link: explorerUrl 
      });
      
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
      setUpdating(false);
    }
  };

  const handleUpdate = async () => {
    if (!program || !publicKey) {
      setError('Please connect your wallet');
      return;
    }

    if (!metadataUrl) {
      setError('Please provide a metadata URL');
      return;
    }

    setError('');
    setSuccess(null);
    setUpdating(true);

    try {
      console.log('=== Starting Agent Update ===');
      console.log('Wallet:', publicKey.toBase58());
      console.log('New Metadata URL:', metadataUrl);
      
      const signature = await updateAgent(program, publicKey, metadataUrl);
      
      console.log('✅ Update successful!');
      console.log('Transaction signature:', signature);
      
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
      const explorerUrl = `https://explorer.solana.com/tx/${signature}${clusterParam}`;
      setSuccess({ 
        message: 'Agent updated successfully!', 
        link: explorerUrl 
      });
      
      // Refresh agent account data
      const [agentPDA] = getAgentPDA(publicKey);
      // @ts-ignore - Anchor types don't include account names from IDL
      const account = await program.account.agentAccount.fetch(agentPDA);
      setAgentAccount(account as AgentAccount);
      
      // Fetch updated metadata JSON
      try {
        const metadataResponse = await fetch(metadataUrl);
        if (metadataResponse.ok) {
          const metadataJson = await metadataResponse.json();
          setMetadata(JSON.stringify(metadataJson, null, 2));
        }
      } catch (metadataErr) {
        console.error('Error fetching updated metadata:', metadataErr);
      }
    } catch (err: any) {
      console.error('❌ Update error:', err);
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Error logs:', err.logs);
      
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    } finally {
      setUpdating(false);
    }
  };

  if (pageMode === 'loading') {
    return (
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="text-center text-muted-foreground">Loading agent data...</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const isUpdateMode = pageMode === 'update';
  const actionText = isUpdateMode ? 'Update' : 'Register';
  const actioningText = isUpdateMode ? 'Updating...' : 'Registering...';
  const handleAction = isUpdateMode ? handleUpdate : handleRegister;

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">{isUpdateMode ? 'My Agent' : 'Register Agent'}</h1>
            <p className="text-muted-foreground">
              {isUpdateMode 
                ? 'Update your agent metadata on the Trustless platform'
                : 'Register your wallet as an agent on the Trustless platform'
              }
            </p>
          </div>

          {!publicKey && (
            <Card className="mb-6 border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive font-medium">
                  Please connect your wallet
                </p>
              </CardContent>
            </Card>
          )}

          {isUpdateMode && agentAccount && (
            <Card className="mb-6 border-primary">
              <CardHeader>
                <CardTitle>Agent Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={agentAccount.active ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {agentAccount.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Average Rating:</span>
                  <span className="font-medium">{agentAccount.avgRating.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-mono text-xs">
                    {new Date(agentAccount.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Address</CardTitle>
                <CardDescription>
                  {isUpdateMode ? 'Your registered agent address' : 'This wallet address will be registered as the agent'}
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
                    <div className="relative">
                      <textarea
                        value={metadata}
                        onChange={(e) => setMetadata(e.target.value)}
                        className="w-full h-64 p-4 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder='{\n  "name": "My Agent",\n  "description": "Agent description",\n  "image": "https://..."\n}'
                      />
                      {metadata && (() => {
                        const validation = validateMetadata(metadata);
                        return validation.valid ? (
                          <div className="absolute top-2 right-2 text-green-500 text-xs flex items-center gap-1">
                            <span>✓</span>
                            <span>Valid</span>
                          </div>
                        ) : (
                          <div className="absolute top-2 right-2 text-red-500 text-xs flex items-center gap-1">
                            <span>✗</span>
                            <span>Invalid</span>
                          </div>
                        );
                      })()}
                    </div>
                    
                    <Button
                      onClick={handleUpload}
                      disabled={uploading || !metadata.trim() || !publicKey || metadata === originalMetadata}
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
                  <p className="text-primary text-sm">
                    {success.message}
                    {success.link && (
                      <>
                        {' '}
                        <a 
                          href={success.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-primary/80"
                        >
                          View on Explorer →
                        </a>
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleAction}
              disabled={updating || !metadataUrl || !publicKey}
              size="lg"
              className="w-full"
            >
              {updating ? actioningText : `${actionText} Agent`}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
