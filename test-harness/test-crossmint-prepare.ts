// Test the /prepare endpoint with Crossmint wallet detection

const FACILITATOR_URL = 'http://localhost:4000';
const CROSSMINT_WALLET = '6aKfoiTFtWLz8Bz1ocksMmbK3Wb9iFd49h7qxmcwQQLN';
const NON_CROSSMINT_WALLET = 'CWnJn8R5Awdq9wfXJrUj5CmK66YiMiD6yqoFn37fRzDt';

const paymentRequirements = {
  scheme: 'exact',
  network: 'solana-devnet',
  maxAmountRequired: '10000',
  resource: 'https://example.com/test',
  description: 'Test payment',
  mimeType: 'application/json',
  maxTimeoutSeconds: 300,
  payTo: 'CWnJn8R5Awdq9wfXJrUj5CmK66YiMiD6yqoFn37fRzDt',
  asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

async function testPrepare(walletAddress: string, label: string, enableTrustless: boolean = false) {
  console.log(`\n=== Testing /prepare with ${label} ===`);
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Trustless: ${enableTrustless}`);

  try {
    const response = await fetch(`${FACILITATOR_URL}/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        paymentRequirements,
        enableTrustless,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('SUCCESS!');
      console.log('Fee payer:', result.paymentRequirements.extra?.feePayer);
      console.log('Is Crossmint wallet:', result.paymentRequirements.extra?.isCrossmintWallet);
      console.log('Transaction length:', result.transaction?.length);
    } else {
      console.log('ERROR:', result);
    }
  } catch (error: any) {
    console.error('Request failed:', error.message);
  }
}

async function main() {
  console.log('Testing Crossmint wallet detection in /prepare endpoint');

  // Test 1: Crossmint wallet (should set fee payer to wallet itself)
  await testPrepare(CROSSMINT_WALLET, 'Crossmint wallet', false);

  // Test 2: Non-Crossmint wallet (should set fee payer to facilitator)
  await testPrepare(NON_CROSSMINT_WALLET, 'Non-Crossmint wallet', false);

  // Test 3: Crossmint wallet with trustless
  await testPrepare(CROSSMINT_WALLET, 'Crossmint wallet (trustless)', true);

  console.log('\n=== Tests Complete ===');
}

main().catch(console.error);
