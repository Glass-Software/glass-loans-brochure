#!/usr/bin/env tsx
/**
 * Test script for underwriting form submission
 * Bypasses the UI and directly calls the API endpoint
 *
 * Setup:
 *   1. Ensure your dev server is running (npm run dev)
 *   2. Comment out RECAPTCHA_SECRET_KEY in .env.local to bypass reCAPTCHA
 *   3. Set BATCHDATA_API_KEY and BATCHDATA_USE_MOCK=false to use production API
 *
 * Usage:
 *   npx tsx scripts/test-underwriting-form.ts
 *
 * Customize test data by editing the testFormData object below.
 */

// Using Node.js built-in fetch (Node 18+)

// Test data - modify these values as needed
const testFormData = {
  // Step 1: Property Details
  propertyAddress: "2316 Fernwood Drive",
  propertyCity: "Nashville",
  propertyState: "TN",
  propertyZip: "37216",
  propertyCounty: "Davidson County",
  purchasePrice: 450000,
  rehab: 50000,
  squareFeet: 1130,
  bedrooms: 2,
  bathrooms: 1,
  yearBuilt: 1951,
  propertyType: "SFR" as const,

  // Step 2: Property Condition & ARV
  propertyCondition: "Bad" as const,
  renovationPerSf: 50000 / 1130, // $44.25/SF → "Medium $50-60/SF"
  userEstimatedAsIsValue: 330000,
  userEstimatedArv: 440000,

  // Step 3: Loan Terms
  interestRate: 12,
  months: 12,
  loanAtPurchase: 400000,
  renovationFunds: 0,
  closingCostsPercent: 2.5,
  points: 2,

  // Step 4: Market Details
  marketType: "Primary" as const,
  additionalDetails: "Test submission via script",
  compLinks: ["1904 avalon ave, nashville, tn 37216"],
};

const testEmail = "hervey711@gmail.com";
// NOTE: If this email is already verified in the DB, results will be returned directly (no email sent).
// To test email flow, use a new email address or set email_verified=0 in the users table.

// API endpoint - change this if testing against production
const API_BASE = process.env.API_BASE || "http://localhost:3000";

async function submitUnderwriting() {
  console.log("\n🚀 Starting underwriting test...\n");
  console.log("Property Address:", testFormData.propertyAddress);
  console.log(
    "Purchase Price:",
    `$${testFormData.purchasePrice.toLocaleString()}`,
  );
  console.log("Email:", testEmail);
  console.log("\n" + "=".repeat(60) + "\n");

  try {
    const response = await fetch(`${API_BASE}/api/underwrite/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testEmail,
        recaptchaToken: "test_bypass_token", // Will be bypassed if RECAPTCHA_BYPASS=true
        formData: testFormData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP ${response.status}: ${errorData.error || "Unknown error"}`,
      );
    }

    // Check if we got a streaming response
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("text/event-stream")) {
      console.log("📡 Receiving streaming response...\n");
      await handleStreamingResponse(response);
    } else {
      // Non-streaming response
      const data = await response.json();
      console.log("\n✅ Non-streaming response received:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

async function handleStreamingResponse(response: any) {
  if (!response.body) {
    throw new Error("No response body available");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("\n🏁 Stream ended\n");
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete events (separated by \n\n)
      const events = buffer.split("\n\n");
      buffer = events.pop() || ""; // Keep incomplete event in buffer

      for (const event of events) {
        if (!event.trim() || !event.startsWith("data: ")) {
          continue;
        }

        try {
          const jsonStr = event.substring(6); // Remove "data: " prefix
          const data = JSON.parse(jsonStr);

          if (data.type === "progress") {
            console.log(
              `📊 Progress [Step ${data.step}]: ${data.status} (${data.progress}%)`,
            );
            // Log any warnings or errors in progress messages
            if (data.warning || data.error) {
              console.warn(`⚠️  ${data.warning || data.error}`);
            }
          } else if (data.type === "complete") {
            console.log("\n✅ Processing complete!\n");

            if (data.data?.emailSent) {
              console.log("📧 Verification email sent to:", testEmail);
              console.log(
                "⚠️  Check your email for a link to view the results.",
              );
              if (data.data?.reportId) {
                console.log("📝 Report ID:", data.data.reportId);
              }
            } else if (data.data?.results) {
              console.log(
                "✓ Email already verified - showing results directly\n",
              );
              displayResults(data.data.results);
            } else {
              console.error(
                "⚠️  Warning: No results or emailSent flag in response",
              );
              console.log("Response data:", JSON.stringify(data.data, null, 2));
            }
          } else if (data.type === "error") {
            console.error("\n❌ Error:", data.status);
            if (data.data?.code) {
              console.error("Error Code:", data.data.code);
            }
          }
        } catch (parseError) {
          console.error("Failed to parse event:", event);
        }
      }
    }
  } catch (error: any) {
    console.error("\n❌ Stream error:", error.message);
    throw error;
  }
}

function displayResults(results: any) {
  console.log("=".repeat(60));
  console.log("📋 UNDERWRITING RESULTS");
  console.log("=".repeat(60));

  // Gary's Opinion
  console.log("\n🎯 Gary's Final Score:", results.finalScore || "N/A", "/ 100");

  // Deal Metrics
  console.log("\n💰 Deal Metrics:");
  const arv = results.aiEstimates?.estimatedARV || results.calculations?.arv;
  const asIsValue = results.aiEstimates?.asIsValue;
  const totalProjectCost = results.calculations?.totalProjectCost;
  const profit = results.calculations?.borrowerProfit;
  const loanToArv = results.calculations?.loanToArv;

  console.log("  ARV:", arv ? `$${arv.toLocaleString()}` : "N/A");
  console.log(
    "  As-Is Value:",
    asIsValue ? `$${asIsValue.toLocaleString()}` : "N/A",
  );
  console.log(
    "  Total Project Cost:",
    totalProjectCost ? `$${totalProjectCost.toLocaleString()}` : "N/A",
  );
  console.log(
    "  Borrower Profit:",
    profit ? `$${profit.toLocaleString()}` : "N/A",
  );
  console.log("  Loan-to-ARV:", loanToArv ? `${loanToArv.toFixed(1)}%` : "N/A");

  // Loan Metrics
  console.log("\n💳 Loan Metrics:");
  console.log(
    "  Loan Amount:",
    results.calculations?.totalLoanAmount
      ? `$${results.calculations.totalLoanAmount.toLocaleString()}`
      : "N/A",
  );
  console.log(
    "  Total Interest:",
    results.calculations?.totalInterest
      ? `$${results.calculations.totalInterest.toLocaleString()}`
      : "N/A",
  );
  console.log(
    "  Closing Costs:",
    results.calculations?.closingCostsDollar
      ? `$${results.calculations.closingCostsDollar.toLocaleString()}`
      : "N/A",
  );
  console.log(
    "  Points:",
    results.calculations?.pointsDollar
      ? `$${results.calculations.pointsDollar.toLocaleString()}`
      : "N/A",
  );
  console.log(
    "  Underwater Day 1:",
    results.calculations?.isLoanUnderwater ? "YES ⚠️" : "NO ✓",
  );

  // Stress Test
  console.log("\n📉 Stress Test (10% ARV drop):");
  console.log(
    "  Stress Tested Profit:",
    results.calculations?.stressTestedProfit
      ? `$${results.calculations.stressTestedProfit.toLocaleString()}`
      : "N/A",
  );
  console.log(
    "  Stress Tested L-ARV:",
    results.calculations?.stressTestedLArv
      ? `${results.calculations.stressTestedLArv.toFixed(1)}%`
      : "N/A",
  );

  // Risk Flags
  if (
    results.aiEstimates?.riskFlags &&
    results.aiEstimates.riskFlags.length > 0
  ) {
    console.log("\n⚠️  Risk Flags:");
    results.aiEstimates.riskFlags.forEach((flag: any) => {
      const emoji =
        flag.severity === "critical"
          ? "🔴"
          : flag.severity === "warning"
            ? "🟡"
            : "ℹ️";
      console.log(
        `  ${emoji} [${flag.severity.toUpperCase()}] ${flag.message}`,
      );
    });
  }

  // Valuation Method
  if (results.aiEstimates?.valuationMethod) {
    console.log(
      "\n📊 Valuation Method:",
      results.aiEstimates.valuationMethod.toUpperCase(),
    );
    if (results.aiEstimates.batchDataUsed) {
      console.log("  BatchData Tier:", results.aiEstimates.compTier || "N/A");
      console.log(
        "  AVM Value:",
        results.aiEstimates.avmValue
          ? `$${results.aiEstimates.avmValue.toLocaleString()}`
          : "N/A",
      );
      console.log(
        "  AVM Confidence:",
        results.aiEstimates.avmConfidence
          ? `${(results.aiEstimates.avmConfidence * 100).toFixed(0)}%`
          : "N/A",
      );
    }
  }

  // Comparables
  if (
    results.aiEstimates?.compsUsed &&
    results.aiEstimates.compsUsed.length > 0
  ) {
    console.log(
      `\n🏘️  Comparables Used (${results.aiEstimates.compsUsed.length}):`,
    );
    results.aiEstimates.compsUsed
      .slice(0, 5)
      .forEach((comp: any, i: number) => {
        console.log(
          `  ${i + 1}. ${comp.address} - $${comp.price?.toLocaleString() || "N/A"} (${comp.sqft || "N/A"} sqft)`,
        );
      });
  }

  // Gary's Opinion
  if (results.garyOpinion) {
    console.log("\n📝 Gary's Opinion:");
    const opinion = results.garyOpinion;
    // Show first 800 characters
    console.log(
      opinion.length > 800 ? opinion.substring(0, 800) + "..." : opinion,
    );
  }

  // Report Link
  if (results.reportId) {
    console.log("\n🔗 Report Link:");
    console.log(
      `  http://localhost:3000/underwrite/results/${results.reportId}`,
    );
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

// Run the test
submitUnderwriting();
