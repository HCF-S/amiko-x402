# Quick Setup Guide

## 1. Install Dependencies

```bash
cd /Users/william/Work/twin/amiko-x402/facilitator
pnpm install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your private keys:

```env
# For Base Sepolia (EVM)
EVM_PRIVATE_KEY=0xYourPrivateKeyHere

# For Solana Devnet (SVM)
SVM_PRIVATE_KEY=YourBase58EncodedSolanaPrivateKeyHere
```

## 3. Get Testnet Tokens

### Base Sepolia ETH
Visit: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### Solana Devnet SOL
Visit: https://faucet.solana.com

## 4. Start the Server

```bash
pnpm dev
```

Server will run at: http://localhost:3000

## 5. Test the Endpoints

### Check supported networks
```bash
curl http://localhost:3000/supported
```

### Health check
```bash
curl http://localhost:3000/
```

## Production Build

```bash
pnpm build
pnpm start
```

## Troubleshooting

### Missing dependencies
If you see TypeScript errors about missing modules, run:
```bash
pnpm install
```

### Invalid private keys
- EVM private key should start with `0x`
- SVM private key should be base58 encoded (no `0x` prefix)

### Network errors
- Ensure you have testnet tokens in your wallet
- Check that the RPC endpoints are accessible
- For Solana, you can set a custom RPC: `SVM_RPC_URL=https://api.devnet.solana.com`
