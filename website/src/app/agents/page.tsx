'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Simple Badge component
const Badge = ({ children, variant = 'default', className = '' }: { 
  children: React.ReactNode; 
  variant?: 'default' | 'secondary' | 'outline';
  className?: string;
}) => {
  const variantStyles = {
    default: 'bg-blue-500 text-white',
    secondary: 'bg-gray-200 text-gray-700',
    outline: 'border border-gray-300 text-gray-700',
  };
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

interface Agent {
  wallet: string;
  name: string | null;
  description: string | null;
  metadata_uri: string | null;
  active: boolean;
  auto_created: boolean;
  avg_rating: number;
  total_weight: string;
  created_at: string;
  updated_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents');
      
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }
      
      const data = await response.json();
      setAgents(data.agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Registered Agents</h1>
          <p className="text-gray-600">
            Browse all agents registered on the Trustless protocol
          </p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">Loading agents...</p>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && agents.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600">No agents registered yet.</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card key={agent.wallet} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {agent.name || 'Unnamed Agent'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {formatAddress(agent.wallet)}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2">
                      {agent.active ? (
                        <Badge variant="default" className="bg-green-500">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {agent.auto_created && (
                        <Badge variant="outline">Auto</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {agent.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {agent.description}
                    </p>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Rating:</span>
                      <span className="font-medium">
                        {agent.avg_rating > 0 
                          ? `⭐ ${agent.avg_rating.toFixed(2)}`
                          : 'No ratings yet'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Jobs:</span>
                      <span className="font-medium">
                        {agent.total_weight !== '0' ? agent.total_weight : 'None'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Registered:</span>
                      <span className="font-medium">
                        {formatDate(agent.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t space-y-2">
                    <Link href={`/services?agent_wallet=${agent.wallet}`}>
                      <Button variant="outline" className="w-full text-sm">
                        View Services →
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          Total Agents: {agents.length}
        </div>
      </main>
    </div>
  );
}
