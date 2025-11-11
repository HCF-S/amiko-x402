import { wrapFetchWithPayment, createSigner } from './packages/x402-fetch/src/index.js';

const testWalletPrivateKey = "5XmdUGwiujfbd5uEYcoPbZGsXYx49Bqt81nt2RUgcVuuAWvRZtcWjbpEdPVu6Lde1kztDW5WFCQofamdAKX6QDZF";
const x402Endpoint = "https://x402-server.heyamiko.com/solana-devnet/time";

async function testX402Fetch() {
  try {
    console.log('🚀 Starting x402-fetch test...\n');

    // Create a Solana signer from the private key
    console.log('📝 Creating signer for solana-devnet...');
    const signer = await createSigner('solana-devnet', testWalletPrivateKey);
    console.log('✅ Signer created\n');

    // Wrap fetch with payment capability
    console.log('🔧 Wrapping fetch with payment middleware...');
    const fetchWithPayment = wrapFetchWithPayment(
      fetch,
      signer,
      BigInt(1 * 10 ** 6), // Max 1 USDC
      undefined, // Use default payment requirements selector
      {
        svmConfig: {
          rpcUrl: 'https://api.devnet.solana.com',
          trustlessProgramId: 'GPd4z3N25UfjrkgfgSxsjoyG7gwYF8Fo7Emvp9TKsDeW', // Trustless program ID for job registration
        }
      }
    );
    console.log('✅ Fetch wrapped\n');

    // Make the request
    console.log(`📡 Making request to: ${x402Endpoint}`);
    const response = await fetchWithPayment(x402Endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Response status: ${response.status} ${response.statusText}\n`);

    // Parse and display the response
    const data = await response.json();
    console.log('📦 Response data:');
    console.log(JSON.stringify(data, null, 2));

    console.log('📦 Response headers:');
    console.log(response.headers);

    console.log('\n✨ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
testX402Fetch();
