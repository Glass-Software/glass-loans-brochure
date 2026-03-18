/**
 * Test RentCast Comparables Search
 * Property: 1803 Guest Dr, Nashville, TN 37216
 */

import dotenv from "dotenv";
dotenv.config();

async function testRentCastComps() {
  console.log("=".repeat(80));
  console.log("RentCast Comparables Search Test");
  console.log("Property: 1803 Guest Dr, Nashville, TN 37216");
  console.log("=".repeat(80));
  console.log();

  // Check if API key is configured
  if (!process.env.RENTCAST_API_KEY) {
    console.error("❌ RENTCAST_API_KEY not found in environment variables");
    process.exit(1);
  }

  console.log("✅ RentCast API key found");
  console.log();

  // Property details for 1803 Guest Dr, Nashville, TN 37216
  const testProperty = {
    address: "1803 Guest Dr, Nashville, TN 37216",
    latitude: 36.1496,
    longitude: -86.6695,
    bedrooms: 4,
    bathrooms: 2,
    squareFeet: 1885,
    yearBuilt: 1961, // Approximate year built (adjust as needed)
  };

  console.log("📍 Subject Property:");
  console.log(`   Address: ${testProperty.address}`);
  console.log(
    `   Coordinates: ${testProperty.latitude}, ${testProperty.longitude}`,
  );
  console.log(
    `   Beds/Baths: ${testProperty.bedrooms}/${testProperty.bathrooms}`,
  );
  console.log(`   Square Feet: ${testProperty.squareFeet}`);
  console.log(`   Year Built: ${testProperty.yearBuilt}`);
  console.log();

  try {
    // Import RentCast client
    const { getRentCastClient } = await import("../src/lib/rentcast/client");
    const client = getRentCastClient();

    console.log("🔍 Searching for comparables (using API filters)...");
    console.log();

    // Calculate sqft range (±20% for Tier 1)
    const sqftMin = Math.floor(testProperty.squareFeet * 0.8);
    const sqftMax = Math.ceil(testProperty.squareFeet * 1.2);

    // Search parameters - Tier 1 criteria
    const searchParams = {
      latitude: testProperty.latitude,
      longitude: testProperty.longitude,
      radius: 2, // 1 mile radius (Primary market, Tier 1)
      // propertyType: "Single Family",
      bedrooms: `${testProperty.bedrooms - 1}:${testProperty.bedrooms + 1}`, // ±1 bedroom
      squareFootage: `${sqftMin}:${sqftMax}`, // ±20%
      yearBuilt: `${testProperty.yearBuilt - 10}:${testProperty.yearBuilt + 10}`, // ±10 years
      saleDateRange: `*:260`, // Last 260 days (8 months)
      limit: 500, // Get max results (we pay per request, not per result)
    };

    console.log("Search Filters:");
    console.log(`   Radius: ${searchParams.radius} mile`);
    console.log(
      `   Bedrooms: ${testProperty.bedrooms - 1}-${testProperty.bedrooms + 1} (±1)`,
    );
    console.log(`   Square Feet: ${sqftMin}-${sqftMax} (±20%)`);
    console.log(
      `   Year Built: ${testProperty.yearBuilt - 10}-${testProperty.yearBuilt + 10} (±10 years)`,
    );
    console.log(`   Sale Date: Last 260 days (8 months)`);
    console.log(`   Limit: ${searchParams.limit} results`);
    console.log();

    const result = await client.searchProperties(searchParams);

    console.log("📊 Search Results:");
    console.log(`   Total properties found: ${result.properties.length}`);
    console.log();

    if (result.properties.length === 0) {
      console.log("⚠️  No properties found. Try expanding search criteria.");
      return;
    }

    // Display first 10 comps
    const compsToShow = result.properties.slice(0, 50);

    console.log("=".repeat(80));
    console.log("COMPARABLE PROPERTIES");
    console.log("=".repeat(80));
    console.log();

    compsToShow.forEach((prop, index) => {
      console.log(`Comp #${index + 1}`);
      console.log("-".repeat(80));
      console.log(
        `Address:        ${prop.formattedAddress || prop.addressLine1 || "N/A"}`,
      );
      console.log(`Property Type:  ${prop.propertyType || "N/A"}`);
      console.log(`Bedrooms:       ${prop.bedrooms || "N/A"}`);
      console.log(`Bathrooms:      ${prop.bathrooms || "N/A"}`);
      console.log(
        `Square Feet:    ${prop.squareFootage ? prop.squareFootage.toLocaleString() : "N/A"}`,
      );
      console.log(`Year Built:     ${prop.yearBuilt || "N/A"}`);
      console.log(
        `Lot Size:       ${prop.lotSize ? prop.lotSize.toLocaleString() + " sqft" : "N/A"}`,
      );
      console.log(
        `Last Sale:      ${prop.lastSalePrice ? "$" + prop.lastSalePrice.toLocaleString() : "N/A"}`,
      );
      console.log(`Sale Date:      ${prop.lastSaleDate || "N/A"}`);
      console.log(
        `$/SqFt:         ${
          prop.lastSalePrice && prop.squareFootage
            ? "$" + (prop.lastSalePrice / prop.squareFootage).toFixed(2)
            : "N/A"
        }`,
      );

      // Calculate distance if coordinates available
      if (prop.latitude && prop.longitude) {
        const distance = calculateDistance(
          testProperty.latitude,
          testProperty.longitude,
          prop.latitude,
          prop.longitude,
        );
        console.log(`Distance:       ${distance.toFixed(2)} miles`);
      }

      console.log();
    });

    // Calculate average statistics
    const propsWithSales = compsToShow.filter(
      (p) => p.lastSalePrice && p.lastSalePrice > 0,
    );

    if (propsWithSales.length > 0) {
      const avgPrice =
        propsWithSales.reduce((sum, p) => sum + (p.lastSalePrice || 0), 0) /
        propsWithSales.length;
      const avgSqft =
        propsWithSales.reduce((sum, p) => sum + (p.squareFootage || 0), 0) /
        propsWithSales.length;
      const avgPricePerSqft = avgSqft > 0 ? avgPrice / avgSqft : 0;

      console.log("=".repeat(80));
      console.log("MARKET STATISTICS");
      console.log("=".repeat(80));
      console.log(`Properties with sale data: ${propsWithSales.length}`);
      console.log(`Average Sale Price:        $${avgPrice.toLocaleString()}`);
      console.log(`Average Square Feet:       ${avgSqft.toLocaleString()}`);
      console.log(`Average $/SqFt:            $${avgPricePerSqft.toFixed(2)}`);
      console.log();
    }

    console.log("✅ Test completed successfully!");
  } catch (error: any) {
    console.error("❌ Error during test:");
    console.error(error.message);
    if (error.statusCode) {
      console.error(`Status Code: ${error.statusCode}`);
    }
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    process.exit(1);
  }
}

/**
 * Calculate distance between two lat/lng points in miles
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Run the test
testRentCastComps();
