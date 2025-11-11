# Integration Guide

How to integrate X402 payment flow into your application.

## Server Integration

Step-by-step payment flow for server-side implementation.

### Step 1: Request API

```javascript
const response = await fetch('https://x402-server.heyamiko.com/solana-devnet/time');
const { accepts } = await response.json();
const paymentRequirements = accepts[0];
```

### Step 2: Prepare Transaction

```javascript
const prepareResponse = await fetch('https://facilitator.heyamiko.com/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentRequirements,
    walletAddress: 'your-wallet',
    enableTrustless: true
  })
});
const { transaction } = await prepareResponse.json();
```

### Step 3: Sign & Submit

```javascript
const signedTx = await wallet.signTransaction(transaction);
const finalResponse = await fetch('https://x402-server.heyamiko.com/solana-devnet/time', {
  headers: { 'X-PAYMENT': signedTx.serialize().toString('base64') }
});
const jobId = finalResponse.headers.get('X-Job-Id');
```

## Client Side Usage

Automatic payment handling with x402-fetch.

### Installation

> **📦 Note: Package Not Published Yet**
> 
> The npm package is not published yet. For now, import directly from source code at `packages/x402-fetch`

### Basic Usage

```javascript
import { wrapFetchWithPayment, createSigner } from './packages/x402-fetch/src/index.js';

// Create signer
const signer = await createSigner('solana-devnet', 'your-private-key');

// Wrap fetch
const fetchWithPayment = wrapFetchWithPayment(
  fetch,
  signer,
  BigInt(1 * 10 ** 6), // Max 1 USDC
  undefined,
  { svmConfig: { rpcUrl: 'https://api.devnet.solana.com' } }
);

// Use it
const response = await fetchWithPayment(
  'https://x402-server.heyamiko.com/solana-devnet/time'
);
const data = await response.json();
```

### React Example

```javascript
import { wrapFetchWithPayment, createSigner } from './packages/x402-fetch/src/index.js';
import { useWallet } from '@solana/wallet-adapter-react';

function MyComponent() {
  const { signTransaction } = useWallet();

  const callAPI = async () => {
    const signer = await createSigner('solana-devnet', signTransaction);
    const fetchWithPayment = wrapFetchWithPayment(fetch, signer, BigInt(1 * 10 ** 6));
    
    const response = await fetchWithPayment(
      'https://x402-server.heyamiko.com/solana-devnet/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' })
      }
    );
    
    const data = await response.json();
    const jobId = response.headers.get('X-Job-Id');
    return { data, jobId };
  };

  return <button onClick={callAPI}>Call Paid API</button>;
}
```
