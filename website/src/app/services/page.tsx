'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatAssetAmount, getAssetInfo } from '@/lib/assets';

interface AgentService {
  id: string;
  agent_id: string;
  url: string;
  name: string | null;
  description: string | null;
  method: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  agent: {
    id: string;
    address: string;
    name: string | null;
  };
}

export default function ServicesPage() {
  const searchParams = useSearchParams();
  const agentIdParam = searchParams.get('agent_id');

  const [services, setServices] = useState<AgentService[]>([]);
  const [filteredServices, setFilteredServices] = useState<AgentService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>(agentIdParam || '');

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchQuery, selectedAgent]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/services');
      
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      
      const data = await response.json();
      setServices(data.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // Filter by agent
    if (selectedAgent) {
      filtered = filtered.filter(s => s.agent_id === selectedAgent);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.url.toLowerCase().includes(query) ||
        s.agent.name?.toLowerCase().includes(query)
      );
    }

    setFilteredServices(filtered);
  };

  const uniqueAgents = Array.from(
    new Map(services.map(s => [s.agent_id, s.agent])).values()
  );

  const getMethodColor = (method: string | null) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-500';
      case 'POST': return 'bg-green-500';
      case 'PUT': return 'bg-yellow-500';
      case 'DELETE': return 'bg-red-500';
      case 'PATCH': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Agent Services</h1>
          <p className="text-gray-600">
            Browse all x402-enabled services provided by registered agents
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Agents</option>
              {uniqueAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || formatAddress(agent.address)}
                </option>
              ))}
            </select>

            {(searchQuery || selectedAgent) && (
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedAgent('');
                }}
                variant="outline"
                className="h-auto py-2"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <div className="text-sm text-gray-600">
            Showing {filteredServices.length} of {services.length} services
          </div>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">Loading services...</p>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && filteredServices.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600">
                {searchQuery || selectedAgent 
                  ? 'No services match your filters.' 
                  : 'No services registered yet.'}
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && filteredServices.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredServices.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {service.name || 'Unnamed Service'}
                      </CardTitle>
                      <CardDescription className="mt-1 space-y-1">
                        <Link 
                          href={`/agents?agent_id=${service.agent_id}`}
                          className="text-blue-600 hover:underline block"
                        >
                          {service.agent.name || formatAddress(service.agent.address)}
                        </Link>
                        {service.metadata?.accepts?.[0]?.network && (
                          <div className="text-xs text-gray-500 capitalize">
                            Network: {service.metadata.accepts[0].network}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    {service.method && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getMethodColor(service.method)}`}>
                        {service.method}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-4">
                      {service.description}
                    </p>
                  )}
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Endpoint URL:</p>
                      <a
                        href={service.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {service.url}
                      </a>
                    </div>

                    {service.metadata?.accepts && service.metadata.accepts.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Payment Options:</p>
                        <div className="space-y-2">
                          {service.metadata.accepts.map((accept: any, idx: number) => {
                            const asset = accept.asset ? getAssetInfo(accept.asset) : null;
                            return (
                              <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium capitalize">{accept.scheme}</span>
                                  <span className="text-gray-600 capitalize">{accept.network}</span>
                                </div>
                                {accept.maxAmountRequired && accept.asset && (
                                  <div className="text-gray-600">
                                    Max: {formatAssetAmount(accept.maxAmountRequired, accept.asset)}
                                  </div>
                                )}
                                {asset && (
                                  <div className="text-gray-500 text-[10px] mt-1">
                                    {asset.name}
                                    {asset.network && ` (${asset.network})`}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {service.metadata?.x402Version && (
                      <div className="text-xs text-gray-500">
                        x402 Version: {service.metadata.x402Version}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
