import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { metadata } = await request.json();

    if (!metadata) {
      return NextResponse.json(
        { error: 'Metadata is required' },
        { status: 400 }
      );
    }

    // Validate JSON
    let parsedMetadata;
    try {
      parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      );
    }

    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;

    if (!pinataApiKey || !pinataSecretKey) {
      return NextResponse.json(
        { error: 'Pinata API keys not configured' },
        { status: 500 }
      );
    }

    // Upload to Pinata
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretKey,
      },
      body: JSON.stringify({
        pinataContent: parsedMetadata,
        pinataMetadata: {
          name: `agent-metadata-${Date.now()}`,
        },
      }),
    });

    if (!pinataResponse.ok) {
      const errorData = await pinataResponse.text();
      console.error('Pinata error:', errorData);
      return NextResponse.json(
        { error: 'Failed to upload to IPFS' },
        { status: 500 }
      );
    }

    const data = await pinataResponse.json();
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

    return NextResponse.json({
      success: true,
      ipfsHash: data.IpfsHash,
      ipfsUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
