// End-to-end test: /prepare -> /settle with Crossmint wallet
// Tests both non-trustless and trustless flows

const FACILITATOR_URL = 'http://localhost:4000';
const CROSSMINT_WALLET = '6aKfoiTFtWLz8Bz1ocksMmbK3Wb9iFd49h7qxmcwQQLN';
const RECIPIENT_WALLET = 'CWnJn8R5Awdq9wfXJrUj5CmK66YiMiD6yqoFn37fRzDt';

// USDC devnet token
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

const paymentRequirements = {
  scheme: 'exact',
  network: 'solana-devnet',
  maxAmountRequired: '1000', // 0.001 USDC (6 decimals)
  resource: 'https://example.com/test',
  description: 'Test payment for Crossmint E2E',
  mimeType: 'application/json',
  maxTimeoutSeconds: 300,
  payTo: RECIPIENT_WALLET,
  asset: USDC_DEVNET,
};

interface TestResult {
  name: string;
  success: boolean;
  transactionSignature?: string;
  jobId?: string;
  error?: string;
  feePayer?: string;
  isCrossmintWallet?: boolean;
}

async function runTest(
  testName: string,
  enableTrustless: boolean
): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log(`Trustless: ${enableTrustless}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Step 1: Call /prepare
    console.log('Step 1: Calling /prepare...');
    const prepareResponse = await fetch(`${FACILITATOR_URL}/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: CROSSMINT_WALLET,
        paymentRequirements,
        enableTrustless,
      }),
    });

    if (!prepareResponse.ok) {
      const error = await prepareResponse.text();
      return { name: testName, success: false, error: `/prepare failed: ${error}` };
    }

    const prepareResult = await prepareResponse.json();
    const feePayer = prepareResult.paymentRequirements.extra?.feePayer;
    const isCrossmintWallet = prepareResult.paymentRequirements.extra?.isCrossmintWallet;

    console.log('  Fee payer:', feePayer);
    console.log('  Is Crossmint wallet:', isCrossmintWallet);
    console.log('  Transaction length:', prepareResult.transaction?.length);

    // Verify fee payer is the Crossmint wallet (single-signer)
    if (feePayer !== CROSSMINT_WALLET) {
      return {
        name: testName,
        success: false,
        error: `Fee payer should be Crossmint wallet, got: ${feePayer}`,
        feePayer,
        isCrossmintWallet,
      };
    }

    // Step 2: Call /settle
    console.log('\nStep 2: Calling /settle...');
    const paymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: {
        signature: null,
        transaction: prepareResult.transaction,
      },
    };

    const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements: prepareResult.paymentRequirements,
      }),
    });

    const settleResult = await settleResponse.json();

    if (!settleResponse.ok || !settleResult.success) {
      return {
        name: testName,
        success: false,
        error: `/settle failed: ${JSON.stringify(settleResult)}`,
        feePayer,
        isCrossmintWallet,
      };
    }

    console.log('  Transaction signature:', settleResult.transaction);
    console.log('  Job ID:', settleResult.jobId || 'none');

    // For trustless, verify jobId is returned
    if (enableTrustless && !settleResult.jobId) {
      console.log('  WARNING: Trustless enabled but no jobId returned');
    }

    return {
      name: testName,
      success: true,
      transactionSignature: settleResult.transaction,
      jobId: settleResult.jobId,
      feePayer,
      isCrossmintWallet,
    };
  } catch (error: any) {
    return {
      name: testName,
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('CROSSMINT E2E TEST SUITE');
  console.log('='.repeat(60));
  console.log(`Crossmint Wallet: ${CROSSMINT_WALLET}`);
  console.log(`Recipient: ${RECIPIENT_WALLET}`);
  console.log(`Amount: ${paymentRequirements.maxAmountRequired} (0.001 USDC)`);

  const results: TestResult[] = [];

  // Test 1: Non-trustless flow
  results.push(await runTest('Non-Trustless Crossmint Payment', false));

  // Add a small delay between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Trustless flow
  results.push(await runTest('Trustless Crossmint Payment', true));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.success ? 'PASS' : 'FAIL';
    console.log(`\n[${status}] ${result.name}`);

    if (result.success) {
      console.log(`  Transaction: ${result.transactionSignature}`);
      if (result.jobId) {
        console.log(`  Job ID: ${result.jobId}`);
      }
      const explorerUrl = `https://explorer.solana.com/tx/${result.transactionSignature}?cluster=devnet`;
      console.log(`  Explorer: ${explorerUrl}`);
    } else {
      console.log(`  Error: ${result.error}`);
    }
  }

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${passed}/${total} tests passed`);
  console.log('='.repeat(60));

  // Exit with error code if any test failed
  if (passed !== total) {
    process.exit(1);
  }
}

main().catch(console.error);
