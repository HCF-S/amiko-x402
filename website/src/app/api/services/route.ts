import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const services = await prisma.agentServices.findMany({
      orderBy: {
        created_at: 'desc',
      },
      include: {
        agent: {
          select: {
            id: true,
            address: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      services,
      count: services.length,
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch services',
      },
      { status: 500 }
    );
  }
}
