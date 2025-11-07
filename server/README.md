# Amiko x402 Server

A server that demonstrates x402 payment protocol integration using the `x402-express` middleware. This server provides paid endpoints that automatically handle payment verification and settlement.

## Features

- ✅ **Dual-network support** - Both Base and Solana on separate endpoints
- ✅ **Mainnet/Testnet toggle** - Switch networks with environment variable
- ✅ **Automatic payment handling** via x402-express middleware
- ✅ **Simple integration** - just configure endpoints and prices
- ✅ **Facilitator integration** - automatic payment verification and settlement

## Prerequisites

- Node.js v20+
- pnpm
- Running x402 facilitator (see `/facilitator` directory)
- Wallet address to receive payments

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env` file:

```bash
cp .env.example .env
```

3. Configure environment variables:

```env
# Network mode (set to "true" for mainnet)
USE_MAINNET=false

# Facilitator URL (must be running)
FACILITATOR_URL=http://localhost:3000

# Base wallet address (0x... format)
BASE_ADDRESS=0xYourBaseWalletAddress

# Solana wallet address (base58 format)
SOLANA_ADDRESS=YourSolanaWalletAddressInBase58

# Server port
PORT=3001
```

**Note**: You can configure one or both addresses. The server will only enable endpoints for configured networks.

4. Start the server:

```bash
# Development mode
pnpm dev

# Production mode
pnpm build
pnpm start
```

The server will start on `http://localhost:3001`

## Endpoints

### GET /time (Solana)

Returns the current UTC time via Solana network. **Costs $0.01**

- **Network**: Solana Devnet (testnet) or Solana Mainnet
- **Payment to**: `SOLANA_ADDRESS` from `.env`

**Response:**
```json
{
  "time": "2025-11-03T04:15:00.000Z",
  "timezone": "UTC",
  "unix": 1730606100,
  "formatted": "Sun, 03 Nov 2025 04:15:00 GMT",
  "network": "solana-devnet"
}
```

### GET /base/time (Base)

Returns the current UTC time via Base network. **Costs $0.01**

- **Network**: Base Sepolia (testnet) or Base Mainnet
- **Payment to**: `BASE_ADDRESS` from `.env`

**Response:**
```json
{
  "time": "2025-11-03T04:15:00.000Z",
  "timezone": "UTC",
  "unix": 1730606100,
  "formatted": "Sun, 03 Nov 2025 04:15:00 GMT",
  "network": "base-sepolia"
}
```

### Payment Flow

The x402-express middleware automatically:
1. Returns 402 Payment Required if no payment
2. Verifies payment with facilitator
3. Settles payment on blockchain
4. Returns the response if payment is valid

## How It Works

1. **Client requests** `/time` endpoint
2. **x402-express middleware** checks for payment
3. **If no payment**: Returns 402 with payment requirements
4. **If payment present**: 
   - Verifies payment with facilitator
   - Settles transaction on blockchain
   - Passes request to endpoint handler
5. **Server responds** with the time data

## Adding New Paid Endpoints

Simply add them to the `paymentMiddleware` configuration:

```typescript
app.use(
  paymentMiddleware(
    payTo,
    {
      "GET /time": {
        price: "$0.01",
        network: "base-sepolia",
      },
      "GET /weather": {
        price: "$0.05",
        network: "base-sepolia",
      },
      "POST /data": {
        price: "$0.10",
        network: "base-sepolia",
      },
    },
    {
      url: facilitatorUrl,
    },
  ),
);
```

## Network Configuration

The server automatically selects the correct network based on the `USE_MAINNET` environment variable:

**Testnet (Default - `USE_MAINNET=false`):**
- Solana: `solana-devnet`
- Base: `base-sepolia`

**Mainnet (`USE_MAINNET=true`):**
- Solana: `solana`
- Base: `base`

⚠️ **Warning**: Mainnet uses real funds! Make sure your wallet addresses have sufficient balance for transaction fees.

## Integration with Facilitator

This server requires a running x402 facilitator. The facilitator handles:
- Payment verification
- Transaction signing
- Blockchain settlement

Start the facilitator first:
```bash
cd ../facilitator
pnpm dev
```

Then start this server:
```bash
pnpm dev
```

Build packages
```bassh
pnpm build
```

or

```bash
pnpm --filter x402 build
```