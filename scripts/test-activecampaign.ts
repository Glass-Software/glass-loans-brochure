/**
 * Test script for ActiveCampaign integration
 *
 * Usage:
 *   npx tsx scripts/test-activecampaign.ts test@example.com
 *
 * This script will:
 * 1. Add a contact to ActiveCampaign
 * 2. Subscribe them to list 11
 * 3. Add appropriate tags
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { addFreeUser } from "../src/lib/activecampaign/client";

async function testActiveCampaign() {
  const testEmail = process.argv[2] || "test@glassloans.io";
  const firstName = process.argv[3] || "Test";
  const lastName = process.argv[4] || "User";

  console.log("🧪 Testing ActiveCampaign Integration");
  console.log("=====================================");
  console.log(`📧 Test Email: ${testEmail}`);
  console.log(`👤 Test Name: ${firstName} ${lastName}`);
  console.log(`📋 List: 11`);
  console.log("");

  try {
    console.log("⏳ Adding contact to ActiveCampaign...\n");

    await addFreeUser(
      testEmail,
      1, // reportCount
      "TX", // propertyState (optional)
      firstName,
      lastName
    );

    console.log("\n✅ SUCCESS!");
    console.log("=====================================");
    console.log("Contact has been:");
    console.log("  ✓ Created/updated in ActiveCampaign");
    console.log("  ✓ Added to list 11");
    console.log("  ✓ Tagged with: free-underwrite-user, glass-loans, property-state-tx");
    console.log(`  ✓ Name set: ${firstName} ${lastName}`);
    console.log("  ✓ Custom fields set: reportCount=1, propertyState=TX");
    console.log("");
    console.log("🔍 Check your ActiveCampaign dashboard to verify:");
    console.log("   https://yourname.activehosted.com/app/contacts");

  } catch (error: any) {
    console.error("\n❌ ERROR!");
    console.error("=====================================");
    console.error("Message:", error.message);
    console.error("");
    console.error("Troubleshooting:");
    console.error("  1. Verify ACTIVECAMPAIGN_API_KEY is set in .env.local");
    console.error("  2. Verify ACTIVECAMPAIGN_API_URL is set in .env.local");
    console.error("  3. Check that list 11 exists in your ActiveCampaign account");
    console.error("  4. Verify API key has permission to create contacts and add to lists");
    process.exit(1);
  }
}

testActiveCampaign();
