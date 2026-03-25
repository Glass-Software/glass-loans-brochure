#!/usr/bin/env tsx
/**
 * Test script for send-code API endpoint
 * Directly calls /api/underwrite/send-code to test email sending
 *
 * Usage:
 *   # Test against local dev server
 *   npx tsx scripts/test-send-code.ts
 *
 *   # Test against production
 *   npx tsx scripts/test-send-code.ts https://glassloans.io
 */

const SGtestEmail = "hervey711@gmail.com"; // test email address
const marketingConsent = false;

// API endpoint - defaults to localhost, override with first argument
const SG_API_BASE = process.argv[2] || "http://localhost:3000";

async function testSendCode() {
  console.log("\n🚀 Testing send-code endpoint...\n");
  console.log("API Base:", SG_API_BASE);
  console.log("Email:", SGtestEmail);
  console.log("Marketing Consent:", marketingConsent);
  console.log("\n" + "=".repeat(60) + "\n");

  try {
    const startTime = Date.now();

    const response = await fetch(`${SG_API_BASE}/api/underwrite/send-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: SGtestEmail,
        marketingConsent,
      }),
    });

    const duration = Date.now() - startTime;

    console.log(`⏱️  Response received in ${duration}ms`);
    console.log(`📡 Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error response:");
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("✅ Success!");
    console.log(JSON.stringify(data, null, 2));
    console.log("\n📧 Check your email for the verification code.");
    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error: any) {
    console.error("\n❌ Request failed:", error.message);
    process.exit(1);
  }
}

// Run the test
testSendCode();
