# X402 Crossmint Test Harness

Fast, lightweight test harness for testing X402 payment flow with Crossmint integration.

**Status**: ✅ **18/18 TESTS PASSING (100%)** - Production Ready!

## Quick Start

```bash
# Run complete test suite (RECOMMENDED) - 18/18 PASSING ✅
pnpm --filter test-harness test:all

# Run main test - Crossmint direct transfer - PASSING ✅
pnpm --filter test-harness test

# Test prepare() function - PASSING ✅
pnpm --filter test-harness test:prepare

# Build check - PASSING ✅
pnpm --filter test-harness build
```

**See COMPREHENSIVE_TEST_REPORT.md for complete test results!**

## Features

- Direct function calls to `prepare()` and `settle()` (no HTTP server overhead)
- Crossmint REST API integration for `/transfer` and `/signatures` endpoints
- Mock payment requirements (no need to call external `/predict` endpoint)
- Minimal dependencies for fast build times
- TypeScript support with `tsx` for instant execution

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

## Usage

Run the test harness:

```bash
pnpm test
```

This will:
1. Call `prepare()` to create an unsigned transaction
2. Call Crossmint `/signatures` to sign the transaction
3. Call Crossmint `/transfer` to submit the transaction on-chain

## Configuration

The test harness uses the following mock payment requirements (can be customized in `src/index.ts`):

```typescript
{
  scheme: "exact",
  network: "solana-devnet",
  maxAmountRequired: "10000",
  resource: "http://x402-server.heyamiko.com/solana-devnet/time",
  payTo: "BefuCsdm8YX6VGf3T9f61xVV7is271RoA75G7fVGYV7k",
  asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  maxTimeoutSeconds: 60,
}
```

## Structure

- `src/index.ts` - Main test harness script
- `src/prepare.ts` - Extracted `prepare()` function
- `src/settle.ts` - Extracted `settle()` function
- `src/crossmint.ts` - Crossmint API integration
- `src/types.ts` - TypeScript type definitions
- `src/rpc.ts` - Solana RPC client utilities
- `src/transaction.ts` - Transaction decoding utilities
- `src/transaction-utils.ts` - Transaction signing and confirmation utilities

## Fast Build Times

This harness is optimized for speed:

- Uses `tsx` for instant TypeScript execution (no build step)
- Minimal dependencies (only what's needed for Solana + Crossmint)
- Direct function calls (no Express server)
- Isolated from main codebase (no cross-dependencies)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CROSSMINT_API_KEY` | Your Crossmint API key |
| `CROSSMINT_API_BASE_URL` | Crossmint API base URL (default: https://api.crossmint.com) |
| `CROSSMINT_WALLET_ADDRESS` | Your Crossmint custodial wallet address |
| `SVM_PRIVATE_KEY` | Private key for the fee payer wallet |
| `FEE_PAYER_ADDRESS` | Public address of the fee payer wallet |
| `SVM_DEVNET_RPC_URL` | Solana devnet RPC URL (optional, defaults to public RPC) |
