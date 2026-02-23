#!/usr/bin/env node

/**
 * Test reCAPTCHA verification
 */

require('dotenv').config({ path: '.env.local' });

async function testRecaptcha() {
  console.log('Testing reCAPTCHA verification...');
  console.log('RECAPTCHA_SECRET_KEY:', process.env.RECAPTCHA_SECRET_KEY ? 'Set' : 'Not set');

  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.log('⚠️  RECAPTCHA_SECRET_KEY not set - skipping test');
    return;
  }

  // Use a dummy token for testing
  const testToken = 'test_token_12345';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log('Calling reCAPTCHA API...');
    const startTime = Date.now();

    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${testToken}`,
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    const data = await response.json();

    console.log(`✓ Response received in ${duration}ms`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('✅ reCAPTCHA verification working!');
    } else {
      console.log('⚠️  reCAPTCHA verification failed (expected for test token)');
      console.log('Error codes:', data['error-codes']);
    }
  } catch (error) {
    console.error('❌ reCAPTCHA test failed:', error.message);
  }
}

testRecaptcha();
