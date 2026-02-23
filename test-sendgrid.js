#!/usr/bin/env node

/**
 * Test SendGrid email sending
 */

require('dotenv').config({ path: '.env.local' });

async function testSendGrid() {
  console.log('Testing SendGrid...');
  console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'Set' : 'Not set');
  console.log('SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL || 'Not set');

  if (!process.env.SENDGRID_API_KEY) {
    console.log('❌ SENDGRID_API_KEY not set');
    return;
  }

  // Test with a simple API health check (doesn't send email)
  try {
    console.log('Testing SendGrid API connection...');
    const startTime = Date.now();

    const response = await fetch('https://api.sendgrid.com/v3/scopes', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ SendGrid API error: ${response.status} - ${error}`);
      return;
    }

    const data = await response.json();

    console.log(`✓ Response received in ${duration}ms`);
    console.log('API Scopes:', data.scopes);
    console.log('✅ SendGrid API working!');
  } catch (error) {
    console.error('❌ SendGrid test failed:', error.message);
  }
}

testSendGrid();
