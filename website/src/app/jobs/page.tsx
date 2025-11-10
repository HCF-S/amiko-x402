'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ExternalLink, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface JobRecord {
  id: string;
  client_wallet: string;
  agent_wallet: string;
  payment_amount: number;
  created_at_chain: string;
  transaction?: string;
  created_at: string;
  updated_at: string;
  feedback?: {
    id: string;
  } | null;
}

export default function JobsPage() {
  const { publicKey } = useWallet();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (agentFilter.trim() === '') {
      setFilteredJobs(jobs);
    } else {
      const searchTerm = agentFilter.toLowerCase();
      const filtered = jobs.filter(job => 
        job.id.toLowerCase().includes(searchTerm) ||
        job.client_wallet.toLowerCase().includes(searchTerm) ||
        job.agent_wallet.toLowerCase().includes(searchTerm) ||
        (job.transaction && job.transaction.toLowerCase().includes(searchTerm))
      );
      setFilteredJobs(filtered);
    }
  }, [agentFilter, jobs]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs');
      const data = await response.json();

      if (data.success) {
        setJobs(data.jobs);
        setFilteredJobs(data.jobs);
      } else {
        setError(data.error || 'Failed to fetch jobs');
      }
    } catch (err) {
      setError('Failed to fetch jobs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: number) => {
    return (amount / 1_000_000).toFixed(2); // Convert from lamports to USDC
  };

  const getExplorerUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
    return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Job Records</h1>
            <p className="text-gray-600">
              View all registered jobs on the Trustless platform
            </p>
          </div>

          {/* Search and Filter */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by job ID, client, agent, or transaction..."
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="w-full pl-9 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {agentFilter && (
                <Button
                  onClick={() => setAgentFilter('')}
                  variant="outline"
                  className="h-auto py-2"
                >
                  Clear Filter
                </Button>
              )}
            </div>

            <div className="text-sm text-gray-600">
              Showing {filteredJobs.length} of {jobs.length} jobs
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading jobs...</p>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive text-center">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Jobs List */}
          {!loading && !error && (
            <div className="space-y-4">
              {filteredJobs.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      {agentFilter ? 'No jobs found for this agent' : 'No jobs found'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredJobs.map((job) => {
                  const isUserJob = publicKey && job.client_wallet === publicKey.toBase58();
                  const hasFeedback = job.feedback !== null;
                  const canLeaveFeedback = isUserJob && !hasFeedback;

                  return (
                    <Card key={job.id} className="p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-medium truncate">{shortenAddress(job.id)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 hidden sm:inline">•</span>
                                <span className="text-xs text-gray-500">{formatDate(job.created_at_chain)}</span>
                                {isUserJob && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded whitespace-nowrap">
                                    Your Job
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {job.transaction && (
                            <a
                              href={getExplorerUrl(job.transaction)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs whitespace-nowrap sm:flex-shrink-0"
                            >
                              View TX <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-sm text-gray-500 mb-0.5">Client</p>
                            <p className="font-mono text-sm">{shortenAddress(job.client_wallet)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-0.5">Agent</p>
                            <p className="font-mono text-sm">{shortenAddress(job.agent_wallet)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-0.5">Payment</p>
                            <p className="font-semibold">${formatAmount(job.payment_amount)} USDC</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-0.5">Feedback</p>
                            {hasFeedback ? (
                              <Link href={`/feedbacks?search=${job.id}`}>
                                <span className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  View
                                </span>
                              </Link>
                            ) : canLeaveFeedback ? (
                              <Link href={`/submit-feedback?job_id=${job.id}`}>
                                <span className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  Leave
                                </span>
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
