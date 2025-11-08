import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!query.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required',
      }, { status: 400 });
    }

    const searchTerm = query.toLowerCase();

    // Search agents by name, description, or metadata_json
    // Using raw SQL for case-insensitive JSON search
    const agents = await prisma.$queryRaw<any[]>`
      SELECT 
        wallet, name, description, metadata_uri, metadata_json, 
        active, auto_created, avg_rating, total_weight, 
        job_count, feedback_count, created_at, updated_at
      FROM x402.agents
      WHERE 
        LOWER(COALESCE(name, '')) LIKE ${`%${searchTerm}%`}
        OR LOWER(COALESCE(description, '')) LIKE ${`%${searchTerm}%`}
        OR LOWER(metadata_json::text) LIKE ${`%${searchTerm}%`}
      ORDER BY avg_rating DESC, job_count DESC, feedback_count DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get service counts for each agent
    const agentsWithCounts = await Promise.all(
      agents.map(async (agent) => {
        const serviceCount = await prisma.agentServices.count({
          where: { agent_wallet: agent.wallet },
        });
        return {
          ...agent,
          _count: { services: serviceCount },
        };
      })
    );

    // Calculate relevance score for each agent
    const rankedAgents = agentsWithCounts.map(agent => {
      let relevanceScore = 0;

      // Name match (highest priority)
      if (agent.name?.toLowerCase().includes(searchTerm)) {
        relevanceScore += 100;
        if (agent.name.toLowerCase() === searchTerm) {
          relevanceScore += 50; // Exact match bonus
        }
      }

      // Description match
      if (agent.description?.toLowerCase().includes(searchTerm)) {
        relevanceScore += 50;
      }

      // Metadata JSON match
      if (agent.metadata_json) {
        const jsonString = JSON.stringify(agent.metadata_json).toLowerCase();
        if (jsonString.includes(searchTerm)) {
          relevanceScore += 25;
        }
      }

      // Rating boost (0-50 points based on rating)
      relevanceScore += agent.avg_rating * 10;

      // Activity boost
      relevanceScore += Math.min(agent.job_count * 2, 50);
      relevanceScore += Math.min(agent.feedback_count, 25);

      return {
        ...agent,
        relevance_score: relevanceScore,
        service_count: agent._count.services,
      };
    });

    // Sort by relevance score
    rankedAgents.sort((a, b) => b.relevance_score - a.relevance_score);

    // Get total count for pagination
    const totalCountResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::int as count
      FROM x402.agents
      WHERE 
        LOWER(COALESCE(name, '')) LIKE ${`%${searchTerm}%`}
        OR LOWER(COALESCE(description, '')) LIKE ${`%${searchTerm}%`}
        OR LOWER(metadata_json::text) LIKE ${`%${searchTerm}%`}
    `;
    const totalCount = Number(totalCountResult[0].count);

    return NextResponse.json({
      success: true,
      query,
      agents: rankedAgents,
      count: rankedAgents.length,
      total: totalCount,
      pagination: {
        limit,
        offset,
        has_more: offset + rankedAgents.length < totalCount,
      },
    });
  } catch (error) {
    console.error('Error searching agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search agents',
      },
      { status: 500 }
    );
  }
}
