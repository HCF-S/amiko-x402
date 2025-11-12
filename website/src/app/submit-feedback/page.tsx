'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTrustlessProgram } from '@/hooks/useTrustlessProgram';
import { submitFeedback } from '@/lib/submit-feedback';

interface JobRecord {
  id: string;
  client_wallet: string;
  agent_wallet: string;
  payment_amount: number;
  created_at_chain: string;
}

function SubmitFeedbackPageContent() {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();
  const { program } = useTrustlessProgram();
  
  const [jobId, setJobId] = useState<string>('');
  const [job, setJob] = useState<JobRecord | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [commentUri, setCommentUri] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ message: string; link?: string } | null>(null);

  useEffect(() => {
    const jobIdParam = searchParams.get('job_id');
    if (jobIdParam) {
      setJobId(jobIdParam);
      fetchJob(jobIdParam);
    }
  }, [searchParams]);

  const fetchJob = async (id: string) => {
    try {
      const response = await fetch(`/api/jobs`);
      const data = await response.json();
      
      if (data.success) {
        const foundJob = data.jobs.find((j: JobRecord) => j.id === id);
        if (foundJob) {
          setJob(foundJob);
          
          // Verify user is the client
          if (publicKey && foundJob.client_wallet !== publicKey.toBase58()) {
            setError('You are not authorized to submit feedback for this job');
          }
        } else {
          setError('Job not found');
        }
      }
    } catch (err) {
      console.error('Error fetching job:', err);
      setError('Failed to fetch job details');
    }
  };

  const handleSubmit = async () => {
    if (!program || !publicKey || !job) {
      setError('Please connect your wallet');
      return;
    }

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setError('');
    setSuccess(null);
    setLoading(true);

    try {
      console.log('=== Submitting Feedback ===');
      console.log('Job ID:', jobId);
      console.log('Rating:', rating);
      console.log('Comment URI:', commentUri || 'None');

      const jobPubkey = new PublicKey(jobId);
      const signature = await submitFeedback(
        program,
        publicKey,
        jobPubkey,
        rating,
        commentUri || undefined
      );

      console.log('✅ Feedback submitted!');
      console.log('Transaction signature:', signature);

      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
      const explorerUrl = `https://explorer.solana.com/tx/${signature}${clusterParam}`;
      
      setSuccess({
        message: 'Feedback submitted successfully!',
        link: explorerUrl
      });

      // Reset form
      setRating(0);
      setCommentUri('');
    } catch (err: any) {
      console.error('❌ Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return (amount / 1_000_000).toFixed(2);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/jobs">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Jobs
              </Button>
            </Link>
          </div>

          <div>
            <h1 className="text-2xl font-bold mb-2">Submit Feedback</h1>
            <p className="text-gray-600">
              Rate your experience and leave feedback for this job
            </p>
          </div>

          {/* Job Details */}
          {job && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Job ID</p>
                    <p className="font-mono text-xs break-all">{job.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Payment</p>
                    <p className="font-semibold">${formatAmount(job.payment_amount)} USDC</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Agent</p>
                    <p className="font-mono text-xs">{shortenAddress(job.agent_wallet)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Date</p>
                    <p className="text-xs">{new Date(job.created_at_chain).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rating */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rating *</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-10 w-10 ${
                        star <= (hoverRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-gray-200 text-gray-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  You selected: {rating} star{rating > 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comment URI (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comment (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="text"
                placeholder="https://... (IPFS or other URI)"
                value={commentUri}
                onChange={(e) => setCommentUri(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                Optional: Link to detailed feedback stored off-chain (e.g., IPFS)
              </p>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
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
                        className="underline hover:text-primary/80 inline-flex items-center gap-1"
                      >
                        View on Explorer <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </p>
                <div className="mt-4">
                  <Link href="/jobs">
                    <Button variant="outline" size="sm">
                      Back to Jobs
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          {!success && (
            <Button
              onClick={handleSubmit}
              disabled={loading || !publicKey || !job || rating === 0}
              size="lg"
              className="w-full"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SubmitFeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
      </div>
    }>
      <SubmitFeedbackPageContent />
    </Suspense>
  );
}
