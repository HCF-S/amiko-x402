import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: {
        job_count: 'desc',
      },
      select: {
        wallet: true,
        name: true,
        description: true,
        metadata_uri: true,
        active: true,
        auto_created: true,
        avg_rating: true,
        total_weight: true,
        job_count: true,
        feedback_count: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      success: true,
      agents,
      count: agents.length,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch agents',
      },
      { status: 500 }
    );
  }
}
