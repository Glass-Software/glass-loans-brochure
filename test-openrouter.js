#!/usr/bin/env node

/**
 * Test OpenRouter API (Grok)
 */

require('dotenv').config({ path: '.env.local' });

async function testOpenRouter() {
  console.log('Testing OpenRouter API...');
  console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set');

  if (!process.env.OPENROUTER_API_KEY) {
    console.log('❌ OPENROUTER_API_KEY not set');
    return;
  }

  const testPrompt = 'Say "Hello, this is a test!" in JSON format: { "message": "..." }';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    console.log('Calling OpenRouter API...');
    const startTime = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Glass Loans Underwriting Tool',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [
          { role: 'user', content: testPrompt }
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ OpenRouter API error: ${response.status} - ${error}`);
      return;
    }

    const data = await response.json();

    console.log(`✓ Response received in ${duration}ms`);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('✅ OpenRouter API working!');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ OpenRouter API request timed out after 60 seconds');
    } else {
      console.error('❌ OpenRouter test failed:', error.message);
    }
  }
}

testOpenRouter();
