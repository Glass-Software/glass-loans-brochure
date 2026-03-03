/**
 * BatchData API Test Script
 * Tests the BatchData API connection and basic functionality
 *
 * Usage:
 * 1. For MOCK server (free, no credits): Set BATCHDATA_USE_MOCK=true and BATCHDATA_MOCK_API_KEY in .env.local
 * 2. For PRODUCTION server (costs money): Set BATCHDATA_USE_MOCK=false and BATCHDATA_API_KEY in .env.local
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const USE_MOCK = process.env.BATCHDATA_USE_MOCK === "true";
const API_KEY = USE_MOCK
  ? process.env.BATCHDATA_MOCK_API_KEY
  : process.env.BATCHDATA_API_KEY;
const BASE_URL = USE_MOCK
  ? "https://stoplight.io/mocks/batchdata/batchdata/20349728"
  : "https://api.batchdata.com/api/v1";

// Test address (structured format for BatchData API)
const TEST_ADDRESS_STRUCTURED = {
  street: "2316 Fernwood Dr",
  city: "Nashville",
  state: "TN",
  zip: "37216"
};
const TEST_ADDRESS = "2316 Fernwood Dr, Nashville, TN 37216";

console.log("🧪 BatchData API Test Script");
console.log("=" .repeat(60));
console.log("");

// Check if API key is set
if (!API_KEY) {
  const keyName = USE_MOCK ? "BATCHDATA_MOCK_API_KEY" : "BATCHDATA_API_KEY";
  console.error(`❌ ERROR: ${keyName} is not set in environment variables`);
  console.log("");
  console.log("Please set your BatchData API key in .env.local:");
  if (USE_MOCK) {
    console.log("BATCHDATA_USE_MOCK=true");
    console.log("BATCHDATA_MOCK_API_KEY=your_mock_token_here");
  } else {
    console.log("BATCHDATA_API_KEY=your_api_key_here");
  }
  console.log("");
  process.exit(1);
}

console.log("✅ API Key found (length:", API_KEY.length, "chars)");
console.log(`🌐 Environment: ${USE_MOCK ? "MOCK SERVER" : "PRODUCTION"}`);
console.log("🌐 Base URL:", BASE_URL);
console.log("🏠 Test Address:", TEST_ADDRESS);
console.log("");

/**
 * Test 1: DNS Resolution
 */
async function testDNS() {
  console.log("📡 Test 1: DNS Resolution");
  console.log("-".repeat(60));

  try {
    const dns = require('dns').promises;
    const hostname = "api.batchdata.com";

    console.log(`Resolving ${hostname}...`);
    const addresses = await dns.resolve4(hostname);

    console.log(`✅ DNS Resolution successful`);
    console.log(`   IP addresses: ${addresses.join(", ")}`);
    return true;
  } catch (error: any) {
    console.error(`❌ DNS Resolution failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Address Verification
 */
async function testAddressVerification() {
  console.log("");
  console.log("📬 Test 2: Address Verification");
  console.log("-".repeat(60));

  try {
    const requestBody = { requests: [TEST_ADDRESS_STRUCTURED] };
    console.log("Sending request:");
    console.log(JSON.stringify(requestBody, null, 2));
    console.log("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${BASE_URL}/address/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json, application/xml"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error Response:`);
      console.error(errorText);
      return false;
    }

    const data = await response.json();

    // Check for errors in response
    if (data.results?.addresses?.[0]?.error) {
      console.log(`❌ Address verification failed: ${data.results.addresses[0].error}`);
      return false;
    }

    console.log(`✅ Address verification successful`);
    const addr = data.results?.addresses?.[0];
    if (addr) {
      console.log(`   Standardized: ${addr.fullAddress || addr.street1}, ${addr.city}, ${addr.state} ${addr.zip}`);
      console.log(`   Validated: ${addr.meta?.verified ? 'Yes' : 'No'}`);
    }

    return true;

  } catch (error: any) {
    console.error(`❌ Address verification failed: ${error.message}`);

    if (error.name === 'AbortError') {
      console.log("   Reason: Request timeout (10 seconds)");
    }

    return false;
  }
}

/**
 * Test 3: Property Lookup
 */
async function testPropertyLookup() {
  console.log("");
  console.log("🏡 Test 3: Property Lookup");
  console.log("-".repeat(60));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${BASE_URL}/property/lookup/all-attributes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json, application/xml"
      },
      body: JSON.stringify({ requests: [TEST_ADDRESS_STRUCTURED] }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error Response:`);
      console.error(errorText);
      return false;
    }

    const data = await response.json();
    const property = data.results?.properties?.[0];

    if (!property) {
      console.error(`❌ No property data returned`);
      return false;
    }

    console.log(`✅ Property lookup successful`);
    console.log(`   Type: ${property.propertyType || 'N/A'}`);
    console.log(`   Bedrooms: ${property.bedrooms || 'N/A'}`);
    console.log(`   Bathrooms: ${property.bathrooms || 'N/A'}`);
    console.log(`   Square Feet: ${property.squareFeet || 'N/A'}`);
    console.log(`   Year Built: ${property.yearBuilt || 'N/A'}`);
    if (property.avm?.value) {
      console.log(`   AVM Value: $${property.avm.value.toLocaleString()}`);
      console.log(`   AVM Confidence: ${property.avm.confidenceScore}%`);
    }

    return true;

  } catch (error: any) {
    console.error(`❌ Property lookup failed: ${error.message}`);

    if (error.name === 'AbortError') {
      console.log("   Reason: Request timeout (10 seconds)");
    }

    return false;
  }
}

/**
 * Test 4: Comparable Property Search (using Property Search API with compAddress)
 */
async function testComparableProperty() {
  console.log("");
  console.log("🏘️  Test 4: Comparable Property Search (compAddress format)");
  console.log("-".repeat(60));

  try {
    const requestBody = {
      searchCriteria: {
        compAddress: {
          street: TEST_ADDRESS_STRUCTURED.street,
          city: TEST_ADDRESS_STRUCTURED.city,
          state: TEST_ADDRESS_STRUCTURED.state,
          zip: TEST_ADDRESS_STRUCTURED.zip,
        }
      },
      options: {
        useDistance: true,
        distanceMiles: 5,
        useBedrooms: true,
        minBedrooms: -1,  // Relative: subject bedrooms - 1
        maxBedrooms: 1,   // Relative: subject bedrooms + 1
        useBathrooms: true,
        minBathrooms: -1, // Relative: subject bathrooms - 1
        maxBathrooms: 1,  // Relative: subject bathrooms + 1
        useArea: true,
        minAreaPercent: -20, // 80% of subject sqft
        maxAreaPercent: 20,  // 120% of subject sqft
        useYearBuilt: true,
        minYearBuilt: -10,   // Subject year - 10
        maxYearBuilt: 10,    // Subject year + 10
      }
    };

    console.log("Sending request:");
    console.log(JSON.stringify(requestBody, null, 2));
    console.log("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${BASE_URL}/property/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json, application/xml"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error Response:`);
      console.error(errorText);
      return false;
    }

    const data = await response.json();
    const comps = data.results?.properties || [];

    console.log(`✅ Comparable property search successful`);
    console.log("");
    console.log(`📊 Results:`);
    console.log(`   Total comps found: ${comps.length}`);
    console.log(`   Minimum needed: 3`);
    console.log(`   Status: ${comps.length >= 3 ? "✅ SUFFICIENT" : "⚠️  INSUFFICIENT"}`);
    console.log("");

    if (comps.length > 0) {
      console.log("Sample comparables:");
      comps.slice(0, 3).forEach((comp: any, i: number) => {
        const pricePerSqft = comp.squareFeet > 0 ? Math.round(comp.lastSalePrice / comp.squareFeet) : 0;
        console.log(`   ${i + 1}. ${comp.address || 'N/A'}`);
        console.log(`      Price: $${comp.lastSalePrice?.toLocaleString() || 'N/A'}`);
        console.log(`      ${comp.bedrooms} bed / ${comp.bathrooms} bath / ${comp.squareFeet} sqft`);
        console.log(`      $${pricePerSqft}/sqft • ${comp.distance?.toFixed(2)} mi away`);
        if (comp.lastSaleDate) console.log(`      Sold: ${comp.lastSaleDate}`);
      });
      console.log("");

      // Calculate median price per sqft
      const pricesPerSqft = comps
        .filter((c: any) => c.squareFeet > 0 && c.lastSalePrice > 0)
        .map((c: any) => c.lastSalePrice / c.squareFeet)
        .sort((a: number, b: number) => a - b);

      if (pricesPerSqft.length > 0) {
        const mid = Math.floor(pricesPerSqft.length / 2);
        const medianPricePerSqft = pricesPerSqft.length % 2 === 0
          ? (pricesPerSqft[mid - 1] + pricesPerSqft[mid]) / 2
          : pricesPerSqft[mid];

        console.log(`💰 Estimated Value (comp-derived):`);
        console.log(`   Median $/sqft: $${Math.round(medianPricePerSqft)}`);
        console.log(`   Estimated value: $${Math.round(medianPricePerSqft * 1500).toLocaleString()} (assuming ~1500 sqft subject)`);
      }
    }

    return true;

  } catch (error: any) {
    console.error(`❌ Comparable property search failed: ${error.message}`);

    if (error.name === 'AbortError') {
      console.log("   Reason: Request timeout (10 seconds)");
    }

    return false;
  }
}

/**
 * Test 5: Comp Search (Generic endpoint - for comparison)
 */
async function testCompSearch() {
  console.log("");
  console.log("🔍 Test 4: Comp Search (5 mile radius)");
  console.log("-".repeat(60));

  try {
    // First, get property details to build search criteria
    console.log("Step 1: Getting subject property details...");
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 10000);

    const propResponse = await fetch(`${BASE_URL}/property/lookup/all-attributes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json, application/xml"
      },
      body: JSON.stringify({ requests: [TEST_ADDRESS_STRUCTURED] }),
      signal: controller1.signal,
    });

    clearTimeout(timeoutId1);

    if (!propResponse.ok) {
      const errorText = await propResponse.text();
      console.error(`❌ Property lookup failed: ${propResponse.status}`);
      console.error(errorText);
      return false;
    }

    const propData = await propResponse.json();
    const property = propData.results?.properties?.[0];

    if (!property) {
      console.error("❌ No property data returned");
      return false;
    }

    console.log(`✅ Subject property loaded`);
    console.log(`   Type: ${property.propertyType}`);
    console.log(`   Bedrooms: ${property.bedrooms}`);
    console.log(`   Bathrooms: ${property.bathrooms}`);
    console.log(`   Square Feet: ${property.squareFeet}`);
    console.log(`   Lat/Long: ${property.address?.latitude}, ${property.address?.longitude}`);
    console.log("");

    // Now search for comps
    console.log("Step 2: Searching for comparable sales (5mi, 6mo, ±1 bed/bath, ±20% sqft)...");

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const minDate = sixMonthsAgo.toISOString().split("T")[0];

    const searchCriteria = {
      location: {
        latitude: property.address.latitude,
        longitude: property.address.longitude,
        radius: "5",
        radiusUnit: "miles"
      },
      propertyType: property.propertyType,
      bedrooms: {
        min: Math.max(1, property.bedrooms - 1),
        max: property.bedrooms + 1
      },
      bathrooms: {
        min: Math.max(1, property.bathrooms - 1),
        max: property.bathrooms + 1
      },
      squareFeet: {
        min: Math.floor(property.squareFeet * 0.8),
        max: Math.ceil(property.squareFeet * 1.2)
      },
      lastSaleDate: { min: minDate },
      lastSalePrice: { min: 1 }
    };

    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 10000);

    const compResponse = await fetch(`${BASE_URL}/property/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json, application/xml"
      },
      body: JSON.stringify({ requests: [searchCriteria] }),
      signal: controller2.signal,
    });

    clearTimeout(timeoutId2);

    console.log(`Status: ${compResponse.status} ${compResponse.statusText}`);

    if (!compResponse.ok) {
      const errorText = await compResponse.text();
      console.error(`❌ Comp search failed:`);
      console.error(errorText);
      return false;
    }

    const compData = await compResponse.json();
    const comps = compData.results?.properties || [];

    console.log(`✅ Comp search successful`);
    console.log("");
    console.log(`📊 Results:`);
    console.log(`   Total comps found: ${comps.length}`);
    console.log(`   Minimum needed: 3`);
    console.log(`   Status: ${comps.length >= 3 ? "✅ SUFFICIENT" : "⚠️  INSUFFICIENT"}`);
    console.log("");

    if (comps.length > 0) {
      console.log("Sample comps:");
      comps.slice(0, 3).forEach((comp: any, i: number) => {
        const pricePerSqft = comp.squareFeet > 0 ? Math.round(comp.lastSalePrice / comp.squareFeet) : 0;
        console.log(`   ${i + 1}. ${comp.address}`);
        console.log(`      Price: $${comp.lastSalePrice?.toLocaleString()}`);
        console.log(`      ${comp.bedrooms} bed / ${comp.bathrooms} bath / ${comp.squareFeet} sqft`);
        console.log(`      $${pricePerSqft}/sqft • ${comp.distance?.toFixed(2)} mi away`);
        console.log(`      Sold: ${comp.lastSaleDate}`);
      });
      console.log("");

      // Calculate median price per sqft
      const pricesPerSqft = comps
        .filter((c: any) => c.squareFeet > 0 && c.lastSalePrice > 0)
        .map((c: any) => c.lastSalePrice / c.squareFeet)
        .sort((a: number, b: number) => a - b);

      if (pricesPerSqft.length > 0) {
        const mid = Math.floor(pricesPerSqft.length / 2);
        const medianPricePerSqft = pricesPerSqft.length % 2 === 0
          ? (pricesPerSqft[mid - 1] + pricesPerSqft[mid]) / 2
          : pricesPerSqft[mid];

        const estimatedValue = Math.round(medianPricePerSqft * property.squareFeet);
        console.log(`💰 Estimated Value (comp-derived):`);
        console.log(`   Median $/sqft: $${Math.round(medianPricePerSqft)}`);
        console.log(`   Subject sqft: ${property.squareFeet}`);
        console.log(`   Estimated value: $${estimatedValue.toLocaleString()}`);
      }
    }

    return true;

  } catch (error: any) {
    console.error(`❌ Comp search failed: ${error.message}`);

    if (error.name === 'AbortError') {
      console.log("   Reason: Request timeout (10 seconds)");
    }

    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  const results = {
    dns: false,
    addressVerify: false,
    propertyLookup: false,
    comparableProperty: false,
    compSearch: false,
  };

  // Test 1: DNS
  results.dns = await testDNS();

  // Only proceed if DNS works
  if (results.dns) {
    // Test 2: Address Verification
    results.addressVerify = await testAddressVerification();

    // Test 3: Property Lookup
    results.propertyLookup = await testPropertyLookup();

    // Test 4: Comparable Property (CMA endpoint - preferred)
    results.comparableProperty = await testComparableProperty();

    // Test 5: Generic Comp Search (for comparison)
    results.compSearch = await testCompSearch();
  }

  // Summary
  console.log("");
  console.log("=" .repeat(60));
  console.log("📊 Test Summary");
  console.log("=" .repeat(60));
  console.log(`DNS Resolution:           ${results.dns ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Address Verification:     ${results.addressVerify ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Property Lookup:          ${results.propertyLookup ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Comparable Property CMA:  ${results.comparableProperty ? "✅ PASS" : "❌ FAIL"} (preferred)`);
  console.log(`Generic Comp Search:      ${results.compSearch ? "✅ PASS" : "❌ FAIL"}`);
  console.log("");

  const criticalPassed = results.dns && results.addressVerify && results.propertyLookup && results.comparableProperty;

  if (criticalPassed) {
    console.log("🎉 All critical tests passed! BatchData API is working correctly.");
    console.log("");
    console.log("💵 Cost Analysis:");
    console.log("   Per underwriting analysis:");
    console.log("   - 1x Address Verification");
    console.log("   - 1x Property Lookup");
    console.log("   - 1x Property Search with compAddress (for comps)");
    console.log("   = 3 API calls total");
    console.log("");
    console.log("✨ Using Property Search API with compAddress (BatchData comp search standard)");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Please check the errors above.");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("");
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
