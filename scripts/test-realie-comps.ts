#!/usr/bin/env tsx
/**
 * Simple test script for Realie.ai Premium Comparables Search API
 * Tests the integration directly
 *
 * Usage:
 *   npx tsx scripts/test-realie-comps.ts
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });

import { getRealieClient } from "../src/lib/realie/client";

// Test address
const testAddress = "1803 Guest Dr, Nashville, TN 37216";

const formData = {
  squareFeet: 1885,
  bedrooms: 4,
  bathrooms: 2,
  yearBuilt: 1961,
  // propertyType: "house",
  marketType: "primary",
  additionalDetails: "Test submission via script",
};

/**
 * Geocode address using Google Maps Geocoding API
 */
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number }> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is not set");
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    console.warn(`⚠️  Geocoding API returned: ${data.status}`);
    if (data.error_message) {
      console.warn(`   Error: ${data.error_message}`);
    }
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const result = data.results[0];
  const location = result.geometry.location;

  console.log(`✅ Geocoded address: ${result.formatted_address}`);
  console.log(`   Coordinates: ${location.lat}, ${location.lng}`);
  console.log(`   Location Type: ${result.geometry.location_type}\n`);

  return location;
}

async function testRealieAPI() {
  console.log("🔍 Testing Realie.ai Premium Comparables API\n");
  console.log("=".repeat(60));
  console.log("Test Address:", testAddress);
  console.log("=".repeat(60) + "\n");

  // Geocode the address
  const coords = await geocodeAddress(testAddress);

  // Set up search parameters (EXACT TIER 1 CRITERIA)
  const testParams = {
    latitude: coords.lat,
    longitude: coords.lng,
    radius: 1, // Tier 1 for Primary market = 1 mile
    bedsMin: formData.bedrooms,
    sqftMin: Math.floor(formData.squareFeet * 0.8), // ±20% sqft range
    sqftMax: Math.ceil(formData.squareFeet * 1.2),
    // propertyType: "house" as const,
    timeFrame: 6, // Tier 1 = 6 months
    maxResults: 50, // Tier 1 = 50 (we pay per request, not per comp)
  };

  console.log("🔍 Searching for comparable sales...\n");
  console.log("Search Parameters:");
  console.log(`  Location: ${testParams.latitude}, ${testParams.longitude}`);
  console.log(`  Radius: ${testParams.radius} miles`);
  // console.log(`  Bedrooms: ${testParams.bedsMin}-${testParams.bedsMax}`);
  console.log(`  Sqft: ${testParams.sqftMin}-${testParams.sqftMax}`);
  // console.log(`  Property Type: ${testParams.propertyType}`);
  console.log(`  Time Frame: ${testParams.timeFrame} months`);
  console.log("=".repeat(60) + "\n");

  try {
    const client = getRealieClient();
    const result = await client.searchComparables(testParams);

    console.log("✅ API call successful!");
    console.log(`  Total comps found: ${result.comparables.length}\n`);

    // Save results to JSON file
    const outputFile = "realie-tier1-results.json";
    writeFileSync(
      outputFile,
      JSON.stringify(
        {
          testAddress,
          searchParams: testParams,
          totalComps: result.comparables.length,
          comparables: result.comparables,
        },
        null,
        2,
      ),
    );
    console.log(`💾 Results saved to ${outputFile}\n`);

    if (result.comparables.length > 0) {
      console.log("=".repeat(60));
      console.log("COMPARABLE PROPERTIES");
      console.log("=".repeat(60) + "\n");

      result.comparables.forEach((comp, index) => {
        // Use Realie API field names
        const price = comp.transferPrice || 0;
        const sqft = comp.buildingArea || 0;
        const pricePerSqft = sqft > 0 ? price / sqft : 0;

        console.log(`${index + 1}. ${comp.addressFull || comp.address}`);
        console.log(`   Price: $${price.toLocaleString()}`);
        console.log(`   Size: ${sqft.toLocaleString()} sqft`);
        console.log(`   Price/sqft: $${pricePerSqft.toFixed(2)}`);
        console.log(
          `   Bed/Bath: ${comp.totalBedrooms} bed, ${comp.totalBathrooms} bath`,
        );
        if (comp.yearBuilt) console.log(`   Year Built: ${comp.yearBuilt}`);
        console.log(`   Sale Date: ${comp.transferDate || "Unknown"}`);
        if (comp.distance)
          console.log(`   Distance: ${comp.distance.toFixed(2)} miles`);
        console.log();
      });
    } else {
      console.log("⚠️  No comparable properties found.");
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testRealieAPI();
