// Configuration
const API_URL = 'http://localhost:4001/time';
const FACILITATOR_URL = 'http://localhost:4000/prepare';
const WALLET_ADDRESS = '8gaACvqn9YDA34VwhEZVBMNsVc9EV71fKhgR1JTjeL4P'; // Replace with actual wallet address
const ENABLE_TRUSTLESS = false;

async function testPrepareEndpoint() {
  try {
    console.log('Step 1: Fetching API endpoint...');
    console.log(`URL: ${API_URL}\n`);
    
    // Step 1: Fetch the API endpoint (should return 402 with payment requirements)
    const apiResponse = await fetch(API_URL);
    
    console.log(`Response Status: ${apiResponse.status}`);
    
    if (apiResponse.status !== 402) {
      console.error(`Expected 402 status, got ${apiResponse.status}`);
      const text = await apiResponse.text();
      console.log('Response:', text);
      return;
    }
    
    // Get payment requirements from 402 response
    const responseData = await apiResponse.json();
    console.log('402 Response:', JSON.stringify(responseData, null, 2));
    
    // Extract the first payment requirement from the accepts array
    if (!responseData.accepts || responseData.accepts.length === 0) {
      console.error('No payment requirements found in accepts array');
      return;
    }
    
    const paymentRequirements = responseData.accepts[0];
    console.log('\nExtracted Payment Requirements:', JSON.stringify(paymentRequirements, null, 2));
    console.log('\n---\n');
    
    // Step 2: Request facilitator to prepare the transaction
    console.log('Step 2: Requesting facilitator to prepare transaction...');
    console.log(`URL: ${FACILITATOR_URL}`);
    console.log(`Wallet: ${WALLET_ADDRESS}`);
    console.log(`Trustless: ${ENABLE_TRUSTLESS}\n`);
    
    const prepareResponse = await fetch(FACILITATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentRequirements,
        walletAddress: WALLET_ADDRESS,
        enableTrustless: ENABLE_TRUSTLESS,
      }),
    });
    
    console.log(`Response Status: ${prepareResponse.status}`);
    
    if (!prepareResponse.ok) {
      const error = await prepareResponse.json();
      console.error('Prepare Error:', JSON.stringify(error, null, 2));
      return;
    }
    
    const { transaction, paymentRequirements: enrichedRequirements } = await prepareResponse.json();
    
    console.log('\n✅ Transaction prepared successfully!');
    console.log('\nEnriched Payment Requirements:', JSON.stringify(enrichedRequirements, null, 2));
    console.log('\nUnsigned Transaction (base64):');
    console.log(transaction);

    console.log('\n---');
    console.log('Next steps:');
    console.log('1. Client signs the transaction with their wallet');
    console.log('2. Client submits the signed transaction to the blockchain');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testPrepareEndpoint();