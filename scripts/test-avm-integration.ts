import dotenv from "dotenv";
dotenv.config();

import { getRentCastClient } from "../src/lib/rentcast/client";
import { mapPropertyType } from "../src/lib/rentcast/comps";

async function testAVMIntegration() {
  console.log("=".repeat(80));
  console.log("Testing RentCast AVM (Automated Valuation Model)");
  console.log("=".repeat(80));

  const testProperty = {
    address: "1803 Guest Dr, Nashville, TN 37216",
    propertyType: "SFR",
    bedrooms: 4,
    bathrooms: 2,
    squareFootage: 2000,
  };

  try {
    console.log("\n📍 Subject Property:");
    console.log(`   Address: ${testProperty.address}`);
    console.log(`   Type: ${testProperty.propertyType}`);
    console.log(`   Beds/Baths: ${testProperty.bedrooms}br/${testProperty.bathrooms}ba`);
    console.log(`   Square Feet: ${testProperty.squareFootage.toLocaleString()}`);

    console.log("\n⏳ Fetching AVM valuation...\n");

    const startTime = Date.now();
    const client = getRentCastClient();

    const avmResponse = await client.getPropertyValue({
      address: testProperty.address,
      propertyType: mapPropertyType(testProperty.propertyType),
      bedrooms: testProperty.bedrooms,
      bathrooms: testProperty.bathrooms,
      squareFootage: testProperty.squareFootage,
      lookupSubjectAttributes: true,
      // Test comp filtering parameters
      maxRadius: 3, // 3 mile radius
      daysOld: 365, // Last year of sales
      compCount: 20, // Use 20 comps
      yearBuilt: "1950:1980", // Properties built within ~15 years of subject (1961)
    });

    const endTime = Date.now();

    console.log("\n" + "=".repeat(80));
    console.log("AVM RESULTS");
    console.log("=".repeat(80));

    console.log("\n💰 PROPERTY VALUATION:");
    console.log(`   As-Is Value: $${avmResponse.price.toLocaleString()}`);
    console.log(`   Confidence Range: $${avmResponse.priceRangeLow.toLocaleString()} - $${avmResponse.priceRangeHigh.toLocaleString()}`);

    const range = avmResponse.priceRangeHigh - avmResponse.priceRangeLow;
    const percentRange = (range / avmResponse.price) * 100;
    console.log(`   Range: ±${percentRange.toFixed(1)}%`);

    if (avmResponse.subjectProperty) {
      console.log("\n🏠 SUBJECT PROPERTY DETAILS (from RentCast):");
      console.log(`   Address: ${avmResponse.subjectProperty.formattedAddress}`);
      console.log(`   Type: ${avmResponse.subjectProperty.propertyType}`);
      console.log(`   Beds/Baths: ${avmResponse.subjectProperty.bedrooms}br/${avmResponse.subjectProperty.bathrooms}ba`);
      console.log(`   Square Feet: ${avmResponse.subjectProperty.squareFootage?.toLocaleString()}`);
      console.log(`   Year Built: ${avmResponse.subjectProperty.yearBuilt}`);
      console.log(`   Lot Size: ${avmResponse.subjectProperty.lotSize?.toLocaleString()} sqft`);
      console.log(`   Coordinates: ${avmResponse.subjectProperty.latitude}, ${avmResponse.subjectProperty.longitude}`);

      if (avmResponse.subjectProperty.lastSaleDate && avmResponse.subjectProperty.lastSalePrice) {
        const saleDate = new Date(avmResponse.subjectProperty.lastSaleDate);
        console.log(`   Last Sale: $${avmResponse.subjectProperty.lastSalePrice.toLocaleString()} on ${saleDate.toLocaleDateString()}`);
      }
    }

    console.log("\n⏱️  PERFORMANCE:");
    console.log(`   Response Time: ${endTime - startTime}ms`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ TEST PASSED");
    console.log("=".repeat(80));
  } catch (error: any) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ TEST FAILED");
    console.error("=".repeat(80));
    console.error("\nError:", error.message);
    if (error.statusCode) {
      console.error("Status Code:", error.statusCode);
    }
    if (error.code) {
      console.error("Error Code:", error.code);
    }
    if (error.stack) {
      console.error("\nStack:", error.stack);
    }
    process.exit(1);
  }
}

testAVMIntegration();
