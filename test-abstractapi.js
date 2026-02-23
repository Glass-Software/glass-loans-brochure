#!/usr/bin/env node

/**
 * Test AbstractAPI email validation
 */

require('dotenv').config({ path: '.env.local' });

async function testAbstractAPI() {
  console.log('Testing AbstractAPI Email Reputation...');
  console.log('ABSTRACT_API_KEY:', process.env.ABSTRACT_API_KEY ? 'Set' : 'Not set');

  if (!process.env.ABSTRACT_API_KEY) {
    console.log('❌ ABSTRACT_API_KEY not set');
    return;
  }

  const testEmail = 'test@example.com';

  try {
    console.log(`Checking email reputation: ${testEmail}...`);
    const startTime = Date.now();

    const response = await fetch(
      `https://emailreputation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY}&email=${testEmail}`
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ AbstractAPI error: ${response.status} - ${error}`);
      return;
    }

    const data = await response.json();

    console.log(`✓ Response received in ${duration}ms`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.email_deliverability && data.email_deliverability.is_format_valid) {
      console.log('✅ AbstractAPI Email Reputation working!');
      console.log(`   Quality Score: ${data.email_quality.score}`);
      console.log(`   Risk Status: ${data.email_risk.address_risk_status}`);
    } else {
      console.log('⚠️  Email reputation check completed but format invalid');
    }
  } catch (error) {
    console.error('❌ AbstractAPI test failed:', error.message);
  }
}

testAbstractAPI();
