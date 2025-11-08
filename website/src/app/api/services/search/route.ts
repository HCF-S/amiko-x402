import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

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

    // Search services by name, description, url, or method
    const services = await prisma.agentServices.findMany({
      where: {
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            url: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            method: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            agent: {
              OR: [
                {
                  name: {
                    contains: searchTerm,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
                {
                  description: {
                    contains: searchTerm,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
              ],
            },
          },
        ],
      },
      include: {
        agent: {
          select: {
            wallet: true,
            name: true,
            description: true,
            active: true,
            avg_rating: true,
            total_weight: true,
            job_count: true,
            feedback_count: true,
            created_at: true,
          },
        },
      },
      take: limit,
      skip: offset,
    });

    // Calculate relevance score for each service
    const rankedServices = services.map(service => {
      let relevanceScore = 0;

      // Service name match (highest priority)
      if (service.name?.toLowerCase().includes(searchTerm)) {
        relevanceScore += 100;
        if (service.name.toLowerCase() === searchTerm) {
          relevanceScore += 50; // Exact match bonus
        }
      }

      // Service description match
      if (service.description?.toLowerCase().includes(searchTerm)) {
        relevanceScore += 75;
      }

      // URL match
      if (service.url.toLowerCase().includes(searchTerm)) {
        relevanceScore += 50;
      }

      // Method match
      if (service.method?.toLowerCase().includes(searchTerm)) {
        relevanceScore += 25;
      }

      // Agent name match
      if (service.agent.name?.toLowerCase().includes(searchTerm)) {
        relevanceScore += 60;
      }

      // Agent description match
      if (service.agent.description?.toLowerCase().includes(searchTerm)) {
        relevanceScore += 40;
      }

      // Agent rating boost (0-50 points based on agent rating)
      relevanceScore += service.agent.avg_rating * 10;

      // Agent activity boost
      relevanceScore += Math.min(service.agent.job_count * 2, 50);
      relevanceScore += Math.min(service.agent.feedback_count, 25);

      // Active agent boost
      if (service.agent.active) {
        relevanceScore += 20;
      }

      return {
        ...service,
        relevance_score: relevanceScore,
      };
    });

    // Sort by relevance score, then by agent rating
    rankedServices.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) {
        return b.relevance_score - a.relevance_score;
      }
      return b.agent.avg_rating - a.agent.avg_rating;
    });

    // Get total count for pagination
    const totalCount = await prisma.agentServices.count({
      where: {
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            url: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            method: {
              contains: searchTerm,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            agent: {
              OR: [
                {
                  name: {
                    contains: searchTerm,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
                {
                  description: {
                    contains: searchTerm,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
              ],
            },
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      query,
      services: rankedServices,
      count: rankedServices.length,
      total: totalCount,
      pagination: {
        limit,
        offset,
        has_more: offset + rankedServices.length < totalCount,
      },
    });
  } catch (error) {
    console.error('Error searching services:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search services',
      },
      { status: 500 }
    );
  }
}
