#!/usr/bin/env tsx
/**
 * Simple test script for BatchData comparable sales search
 * Tests address verification and comp search directly
 *
 * Usage:
 *   npx tsx scripts/test-batchdata-comps.ts
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { getBatchDataClient } from "../src/lib/batchdata/client";

// Test address - modify as needed
const testAddress = {
  street: "2316 Fernwood Drive",
  city: "Nashville",
  state: "TN",
  zip: "37216",
};

// Comp search options (Tier 1: exact bed/bath match, tight sqft)
const searchOptions = {
  distanceMiles: 1, // 1 mile radius for tight comps
  minBedrooms: 0, // Exact match (Tier 1)
  maxBedrooms: 0, // Exact match (Tier 1)
  minBathrooms: 0, // Exact match (Tier 1)
  maxBathrooms: 0, // Exact match (Tier 1)
  minAreaPercent: -10, // 90% of subject sqft (Tier 1: ±10%)
  maxAreaPercent: 10, // 110% of subject sqft (Tier 1: ±10%)
  minYearBuilt: -10, // Subject year - 10
  maxYearBuilt: 10, // Subject year + 10
};

async function testBatchDataComps() {
  console.log("🔍 Testing BatchData Comparable Sales Search\n");
  console.log("=" .repeat(60));
  console.log("Test Address:");
  console.log(`  ${testAddress.street}`);
  console.log(`  ${testAddress.city}, ${testAddress.state} ${testAddress.zip}`);
  console.log("=" .repeat(60) + "\n");

  try {
    const client = getBatchDataClient();

    // Search for comps directly (no address verification needed)
    console.log("Searching for comparable sales...");
    console.log("Search options:");
    console.log(`  Radius: ${searchOptions.distanceMiles} miles`);
    console.log(`  Bed range: ${searchOptions.minBedrooms} to ${searchOptions.maxBedrooms} (relative)`);
    console.log(`  Bath range: ${searchOptions.minBathrooms} to ${searchOptions.maxBathrooms} (relative)`);
    console.log(`  Size range: ${searchOptions.minAreaPercent}% to ${searchOptions.maxAreaPercent}% (relative)`);

    const compResult = await client.getComparableProperties(testAddress, searchOptions);

    console.log("\n\n✅ Comp search complete!");
    console.log(`  Total comps found: ${compResult.properties.length}`);

    if (compResult.properties.length > 0) {
      console.log("\n" + "=" .repeat(60));
      console.log("COMPARABLE PROPERTIES");
      console.log("=" .repeat(60) + "\n");

      compResult.properties.forEach((comp, index) => {
        const pricePerSqft = comp.squareFeet > 0 ? comp.lastSalePrice / comp.squareFeet : 0;

        console.log(`${index + 1}. ${comp.address}`);
        console.log(`   Price: $${comp.lastSalePrice.toLocaleString()}`);
        console.log(`   Size: ${comp.squareFeet.toLocaleString()} sqft`);
        console.log(`   Price/sqft: $${pricePerSqft.toFixed(2)}`);
        console.log(`   Bed/Bath: ${comp.bedrooms} bed, ${comp.bathrooms} bath`);
        console.log(`   Sale Date: ${comp.lastSaleDate || "Unknown"}`);
        console.log(`   Distance: ${comp.distance} miles\n`);
      });

      // Calculate median price per sqft
      const pricesPerSqft = compResult.properties
        .filter(c => c.squareFeet > 0 && c.lastSalePrice > 0)
        .map(c => c.lastSalePrice / c.squareFeet)
        .sort((a, b) => a - b);

      if (pricesPerSqft.length > 0) {
        const mid = Math.floor(pricesPerSqft.length / 2);
        const median =
          pricesPerSqft.length % 2 === 0
            ? (pricesPerSqft[mid - 1] + pricesPerSqft[mid]) / 2
            : pricesPerSqft[mid];

        console.log("=" .repeat(60));
        console.log("SUMMARY STATISTICS");
        console.log("=" .repeat(60));
        console.log(`  Median Price/sqft: $${median.toFixed(2)}`);
        console.log(`  Min Price/sqft: $${pricesPerSqft[0].toFixed(2)}`);
        console.log(`  Max Price/sqft: $${pricesPerSqft[pricesPerSqft.length - 1].toFixed(2)}`);
      }
    } else {
      console.log("\n⚠️  No comparable properties found.");
      console.log("Try increasing the search radius or relaxing the criteria.");
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testBatchDataComps();
