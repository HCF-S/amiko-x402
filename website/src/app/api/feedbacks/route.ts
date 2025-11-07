import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const feedbacks = await prisma.feedbackRecord.findMany({
      orderBy: {
        timestamp: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      feedbacks,
      count: feedbacks.length,
    });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch feedbacks',
      },
      { status: 500 }
    );
  }
}
