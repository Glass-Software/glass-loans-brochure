#!/usr/bin/env node

/**
 * Test all APIs sequentially to identify which one is causing issues
 */

const { execSync } = require('child_process');

const tests = [
  { name: 'reCAPTCHA', script: 'test-recaptcha.js' },
  { name: 'AbstractAPI', script: 'test-abstractapi.js' },
  { name: 'SendGrid', script: 'test-sendgrid.js' },
  { name: 'OpenRouter', script: 'test-openrouter.js' },
];

console.log('🧪 Running API Tests...\n');
console.log('='.repeat(60));

for (const test of tests) {
  console.log(`\n📋 Testing ${test.name}...`);
  console.log('-'.repeat(60));

  try {
    execSync(`node ${test.script}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n❌ ${test.name} test failed!`);
  }

  console.log('-'.repeat(60));
}

console.log('\n' + '='.repeat(60));
console.log('✅ All API tests completed!');
