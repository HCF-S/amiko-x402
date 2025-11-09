import {
  getBase58Encoder,
  getBase64Encoder,
  createKeyPairSignerFromBytes,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  getCompiledTransactionMessageDecoder,
  compileTransactionMessage,
  decompileTransactionMessage,
} from '@solana/kit';

// Configuration
const API_URL = 'http://localhost:4001/solana-devnet/time';
const FACILITATOR_URL = 'http://localhost:4000/prepare';
const WALLET_ADDRESS = 'AxCLrjDQQLeKv56tV7JiCektV8QJvpRykHqCwmKRGwYh';
const ENABLE_TRUSTLESS = false;
// Private key from facilitator/.env (base58 encoded)
const PRIVATE_KEY_BASE58 = 'uXtMiQYKU3gyvy6AtJr5rF15PHU5z24MXW54UPM3vJm8NoKYmwwUj295oEbEWLJnnDsS9AK86tY57DaDfRbzD3s';

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

    console.log('\n---\n');

    // Step 3: Sign the transaction
    console.log('Step 3: Signing transaction with wallet...\n');

    // Decode the private key from base58
    const base58Encoder = getBase58Encoder();
    const privateKeyBytes = base58Encoder.encode(PRIVATE_KEY_BASE58);
    const signer = await createKeyPairSignerFromBytes(privateKeyBytes);

    console.log('Signer address:', signer.address);

    // Decode the base64-encoded compiled transaction message
    const base64Encoder = getBase64Encoder();
    const compiledMessageBytes = base64Encoder.encode(transaction);
    const compiledMessageDecoder = getCompiledTransactionMessageDecoder();
    const compiledMessage = compiledMessageDecoder.decode(compiledMessageBytes);

    // Decompile it back to a transaction message
    const transactionMessage = decompileTransactionMessage(compiledMessage);

    // Sign the transaction message
    const signedTransaction = await partiallySignTransactionMessageWithSigners(transactionMessage, [signer]);

    // Encode as base64 wire transaction
    const signedTransactionBase64 = getBase64EncodedWireTransaction(signedTransaction);

    // Create the payment payload
    const paymentPayload = {
      scheme: 'exact',
      network: 'solana-devnet',
      x402Version: 1,
      payload: {
        transaction: signedTransactionBase64,
      },
    };

    console.log('✅ Transaction signed successfully!\n');
    console.log('Payment Payload:', JSON.stringify(paymentPayload, null, 2));

    console.log('\n---\n');

    // Step 4: Submit payment to the API endpoint
    console.log('Step 4: Submitting payment to API endpoint...\n');

    // Submit the payment (base64 encode the JSON payload)
    const paymentHeaderValue = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    const paymentResponse = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'X-Payment': paymentHeaderValue,
      },
    });

    console.log(`Response Status: ${paymentResponse.status}`);

    if (paymentResponse.ok) {
      const result = await paymentResponse.text();
      console.log('\n✅ PAYMENT SUCCESSFUL!');
      console.log('\nAPI Response:');
      console.log(result);
    } else {
      const error = await paymentResponse.json();
      console.log('\n❌ Payment failed');
      console.log('Error:', JSON.stringify(error, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testPrepareEndpoint();