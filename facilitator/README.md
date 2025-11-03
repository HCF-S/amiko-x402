# Amiko x402 Facilitator

A production-ready x402 facilitator service that handles payment verification and settlement for the x402 payment protocol. This facilitator supports both **Base Sepolia** (EVM) and **Solana Devnet** (SVM) networks.

## Overview

The facilitator provides three main endpoints:

- `/supported` - Returns the payment kinds supported by the facilitator
- `/verify` - Verifies x402 payment payloads
- `/settle` - Settles x402 payments by signing and broadcasting transactions

## Features

- ✅ **Multi-chain support**: Base Sepolia (EVM) and Solana Devnet (SVM)
- ✅ **Payment verification**: Validates payment payloads before settlement
- ✅ **Automatic settlement**: Signs and broadcasts transactions
- ✅ **CORS enabled**: Ready for frontend integration
- ✅ **Error handling**: Detailed error messages for debugging
- ✅ **TypeScript**: Full type safety

## Prerequisites

- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm (install via `npm install -g pnpm`)
- Private keys for Base Sepolia and/or Solana Devnet
- Testnet tokens:
  - Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
  - Solana Devnet SOL: https://faucet.solana.com

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

3. Configure your environment variables:

```env
# For Base Sepolia support
EVM_PRIVATE_KEY=0xYourPrivateKeyHere

# For Solana Devnet support
SVM_PRIVATE_KEY=YourBase58EncodedSolanaPrivateKeyHere

# Optional: Custom Solana RPC
# SVM_RPC_URL=https://api.devnet.solana.com

# Server port
PORT=3000
```

4. Start the server:

```bash
# Development mode with hot reload
pnpm dev

# Production mode
pnpm build
pnpm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### GET /

Health check endpoint that returns service status and available endpoints.

**Response:**
```json
{
  "service": "Amiko x402 Facilitator",
  "status": "running",
  "endpoints": {
    "supported": "/supported",
    "verify": "/verify",
    "settle": "/settle"
  }
}
```

### GET /supported

Returns information about the payment kinds that the facilitator supports.

**Response:**
```json
{
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia"
    },
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "solana-devnet",
      "extra": {
        "feePayer": "SolanaAddressHere"
      }
    }
  ]
}
```

### POST /verify

Verifies an x402 payment payload.

**Request Body:**
```typescript
{
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}
```

**Response:**
```json
{
  "valid": true,
  "message": "Payment verified successfully"
}
```

### POST /settle

Settles an x402 payment by signing and broadcasting the transaction.

**Request Body:**
```typescript
{
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "message": "Payment settled successfully"
}
```

## Network Support

### Base Sepolia (EVM)
- Network: `base-sepolia`
- Requires: `EVM_PRIVATE_KEY`
- Testnet faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### Solana Devnet (SVM)
- Network: `solana-devnet`
- Requires: `SVM_PRIVATE_KEY`
- Testnet faucet: https://faucet.solana.com
- Optional: Custom RPC via `SVM_RPC_URL`

## Development

```bash
# Run in development mode with hot reload
pnpm dev

# Format code
pnpm format

# Check formatting
pnpm format:check

# Lint code
pnpm lint

# Check linting
pnpm lint:check
```

## Production Deployment

For production use, consider using:
- Testnet: https://x402.org/facilitator
- Production: https://api.cdp.coinbase.com/platform/v2/x402

## Resources

- [x402 Protocol Documentation](https://x402.org)
- [Coinbase Developer Platform](https://www.coinbase.com/developer-platform)
- [x402 GitHub Repository](https://github.com/coinbase/x402)

## License

MIT
