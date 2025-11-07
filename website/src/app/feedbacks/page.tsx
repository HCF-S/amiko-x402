'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ExternalLink, Star } from 'lucide-react';

interface FeedbackRecord {
  id: string;
  job_id: string;
  client_wallet: string;
  agent_wallet: string;
  rating: number;
  comment_uri?: string;
  timestamp: string;
  transaction?: string;
  created_at: string;
  updated_at: string;
}

function FeedbacksPageContent() {
  const searchParams = useSearchParams();
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  useEffect(() => {
    fetchFeedbacks();
    // Set initial filter from URL if present
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setAgentFilter(searchParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (agentFilter.trim() === '') {
      setFilteredFeedbacks(feedbacks);
    } else {
      const searchTerm = agentFilter.toLowerCase();
      const filtered = feedbacks.filter(feedback => 
        feedback.id.toLowerCase().includes(searchTerm) ||
        feedback.job_id.toLowerCase().includes(searchTerm) ||
        feedback.client_wallet.toLowerCase().includes(searchTerm) ||
        feedback.agent_wallet.toLowerCase().includes(searchTerm) ||
        (feedback.transaction && feedback.transaction.toLowerCase().includes(searchTerm))
      );
      setFilteredFeedbacks(filtered);
    }
  }, [agentFilter, feedbacks]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/feedbacks');
      const data = await response.json();

      if (data.success) {
        setFeedbacks(data.feedbacks);
        setFilteredFeedbacks(data.feedbacks);
      } else {
        setError(data.error || 'Failed to fetch feedbacks');
      }
    } catch (err) {
      setError('Failed to fetch feedbacks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getExplorerUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
    return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Feedback Records</h1>
            <p className="text-gray-600">
              View all feedback submissions on the Trustless platform
            </p>
          </div>

          {/* Search and Filter */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by feedback ID, job ID, client, agent, or transaction..."
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
              Showing {filteredFeedbacks.length} of {feedbacks.length} feedbacks
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading feedbacks...</p>
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

          {/* Feedbacks List */}
          {!loading && !error && (
            <div className="space-y-4">
              {filteredFeedbacks.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      {agentFilter ? 'No feedbacks found for this agent' : 'No feedbacks found'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredFeedbacks.map((feedback) => (
                  <Card key={feedback.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium">{shortenAddress(feedback.id)}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">{formatDate(feedback.timestamp)}</span>
                          <span className="text-xs text-gray-500">•</span>
                          {renderStars(feedback.rating)}
                        </div>
                      </div>
                      {feedback.transaction && (
                        <a
                          href={getExplorerUrl(feedback.transaction)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs"
                        >
                          View TX <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-sm text-gray-500 mb-0.5">Client</p>
                        <p className="font-mono text-sm">{shortenAddress(feedback.client_wallet)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-0.5">Agent</p>
                        <p className="font-mono text-sm">{shortenAddress(feedback.agent_wallet)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-0.5">Job ID</p>
                        <p className="font-mono text-sm">{shortenAddress(feedback.job_id)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-0.5">Rating</p>
                        <p className="font-semibold">{feedback.rating} / 5</p>
                      </div>
                    </div>

                    {feedback.comment_uri && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-1">Comment URI</p>
                        <a
                          href={feedback.comment_uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 text-xs flex items-center gap-1 break-all"
                        >
                          {feedback.comment_uri} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function FeedbacksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">Loading feedbacks...</p>
          </div>
        </main>
      </div>
    }>
      <FeedbacksPageContent />
    </Suspense>
  );
}
