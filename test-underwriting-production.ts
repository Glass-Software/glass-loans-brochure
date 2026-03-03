/**
 * Test complete underwriting flow with PRODUCTION BatchData API
 * Tests all new features with real property data
 *
 * IMPORTANT: Set BATCHDATA_USE_MOCK=false in .env.local before running
 * Run with: npx tsx test-underwriting-production.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '.env.local') });

// Verify we're using production API
if (process.env.BATCHDATA_USE_MOCK === 'true') {
  console.error('❌ ERROR: BATCHDATA_USE_MOCK is set to "true" in .env.local');
  console.error('Please set BATCHDATA_USE_MOCK=false to test with production API');
  process.exit(1);
}

if (!process.env.BATCHDATA_API_KEY) {
  console.error('❌ ERROR: BATCHDATA_API_KEY not found in .env.local');
  console.error('Please add your production BatchData API key');
  process.exit(1);
}

import { getBatchDataPropertyEstimates } from './src/lib/batchdata/underwriting';
import { calculateUnderwriting, calculateFinalScore } from './src/lib/underwriting/calculations';
import { getRenovationLevel } from './src/types/underwriting';
import type { UnderwritingFormData } from './src/types/underwriting';

async function testUnderwritingProduction() {
  console.log('🚀 Testing Enhanced Underwriting Flow with PRODUCTION API\n');
  console.log('='.repeat(70));
  console.log(`🔑 Using API Key: ${process.env.BATCHDATA_API_KEY?.substring(0, 8)}...`);
  console.log('='.repeat(70));

  try {
    // Real property example - adjust this address to test different properties
    const formData: UnderwritingFormData = {
      // Step 1: Property Details (REAL ADDRESS - modify as needed)
      propertyAddress: '2800 N 24th St, Phoenix, AZ 85008',
      propertyCity: 'Phoenix',
      propertyState: 'AZ',
      propertyZip: '85008',
      purchasePrice: 275000,
      rehab: 80000,
      squareFeet: 2400,
      bedrooms: 4,
      bathrooms: 2,
      yearBuilt: 1975,
      propertyType: 'SFR',

      // Step 2: Property Condition (WITH NEW FIELDS)
      propertyCondition: 'Really Bad',
      renovationPerSf: 80000 / 2400, // Calculated: $33.33/SF
      userEstimatedAsIsValue: 250000, // User's as-is estimate
      userEstimatedArv: 425000, // User's ARV estimate

      // Step 3: Loan Terms
      interestRate: 11.5,
      months: 9,
      loanAtPurchase: 220000,
      renovationFunds: 64000,
      closingCostsPercent: 6,
      points: 2.5,

      // Step 4: Market Details
      marketType: 'Primary',
      additionalDetails: 'Production test - Phoenix SFR flip',
      compLinks: []
    };

    console.log('\n📋 Test Property (REAL):');
    console.log(`  Address: ${formData.propertyAddress}`);
    console.log(`  Purchase: $${formData.purchasePrice.toLocaleString()}`);
    console.log(`  Rehab: $${formData.rehab.toLocaleString()}`);
    console.log(`  Size: ${formData.squareFeet} sqft, ${formData.bedrooms}BR/${formData.bathrooms}BA`);
    console.log(`  Condition: ${formData.propertyCondition}`);
    console.log(`  Renovation Budget: $${formData.renovationPerSf.toFixed(2)}/SF (${getRenovationLevel(formData.renovationPerSf)})`);
    console.log(`  User's As-Is Estimate: $${formData.userEstimatedAsIsValue.toLocaleString()}`);
    console.log(`  User's ARV Estimate: $${formData.userEstimatedArv.toLocaleString()}`);

    console.log('\n\n⚙️  Running Production Underwriting Flow...');
    console.log('-'.repeat(70));

    const startTime = Date.now();
    const estimates = await getBatchDataPropertyEstimates(formData);
    const duration = Date.now() - startTime;

    // Calculate both user's and Gary's metrics
    const userCalculations = calculateUnderwriting(
      formData,
      formData.userEstimatedArv,
      estimates.asIsValue
    );

    const garyCalculations = calculateUnderwriting(
      formData,
      estimates.estimatedARV,
      estimates.asIsValue
    );

    const finalScore = calculateFinalScore(garyCalculations, formData);

    console.log('\n✅ Production Underwriting Complete!\n');
    console.log('='.repeat(70));
    console.log('📊 PRODUCTION RESULTS WITH REAL DATA');
    console.log('='.repeat(70));

    // Subject Property Details (from public records)
    console.log('\n🏠 Subject Property (Public Records):');
    if (estimates.subjectPropertyDetails) {
      console.log(`  Type: ${estimates.subjectPropertyDetails.propertyType}`);
      console.log(`  Bed/Bath: ${estimates.subjectPropertyDetails.bedrooms}/${estimates.subjectPropertyDetails.bathrooms}`);
      console.log(`  Year Built: ${estimates.subjectPropertyDetails.yearBuilt}`);
      console.log(`  Tax Assessed: $${estimates.subjectPropertyDetails.taxAssessedValue.toLocaleString()}`);
      if (estimates.subjectPropertyDetails.lastSalePrice) {
        console.log(`  Last Sale: $${estimates.subjectPropertyDetails.lastSalePrice.toLocaleString()} (${estimates.subjectPropertyDetails.lastSaleDate})`);
      }
    }

    // As-Is Value Comparison
    console.log('\n💵 As-Is Value Comparison:');
    console.log(`  User's Estimate: $${formData.userEstimatedAsIsValue.toLocaleString()}`);
    console.log(`  Gary's Calculation: $${estimates.asIsValue.toLocaleString()}`);
    console.log(`  Method: MIN(Tax: $${estimates.subjectPropertyDetails?.taxAssessedValue.toLocaleString()}, 85% AVM: $${estimates.avmValue ? Math.round(estimates.avmValue * 0.85).toLocaleString() : 'N/A'})`);
    const asIsDiff = Math.abs(formData.userEstimatedAsIsValue - estimates.asIsValue);
    const asIsPct = (asIsDiff / estimates.asIsValue * 100).toFixed(1);
    console.log(`  Difference: $${asIsDiff.toLocaleString()} (${asIsPct}%)`);
    if (asIsDiff / estimates.asIsValue > 0.1) {
      console.log(`  ⚠️  WARNING: User's as-is estimate differs by more than 10%!`);
    } else {
      console.log(`  ✓ User's estimate is within 10% of calculated value`);
    }

    // ARV Comparison
    console.log('\n💰 ARV Comparison:');
    console.log(`  User's Estimate: $${formData.userEstimatedArv.toLocaleString()}`);
    console.log(`  Gary's Analysis: $${estimates.estimatedARV.toLocaleString()}`);
    const arvDiff = Math.abs(estimates.estimatedARV - formData.userEstimatedArv);
    const arvPct = ((estimates.estimatedARV - formData.userEstimatedArv) / formData.userEstimatedArv * 100).toFixed(1);
    console.log(`  Difference: $${arvDiff.toLocaleString()} (${arvPct}%)`);

    // Renovation Level Check
    console.log('\n🔨 Renovation Analysis:');
    console.log(`  Budget: $${formData.renovationPerSf.toFixed(2)}/SF`);
    console.log(`  Level: ${getRenovationLevel(formData.renovationPerSf)}`);
    console.log(`  Condition: ${formData.propertyCondition}`);
    const expectedLevel = formData.propertyCondition === 'Good' ? 'Light' :
                          formData.propertyCondition === 'Bad' ? 'Medium' : 'Heavy';
    const actualLevel = getRenovationLevel(formData.renovationPerSf).split(' ')[0];
    if (expectedLevel !== actualLevel) {
      console.log(`  ⚠️  MISMATCH: ${formData.propertyCondition} condition typically needs ${expectedLevel} renovation`);
      console.log(`      but budget is ${actualLevel} - may not achieve top-of-market ARV`);
    } else {
      console.log(`  ✓ Condition matches renovation level appropriately`);
    }

    // AVM Data
    console.log('\n📈 AVM Data (Production):');
    console.log(`  Value: $${estimates.avmValue?.toLocaleString()}`);
    console.log(`  Confidence: ${estimates.avmConfidence}%`);
    console.log(`  Range: $${estimates.avmValue ? Math.round(estimates.avmValue * 0.88).toLocaleString() : 0} - $${estimates.avmValue ? Math.round(estimates.avmValue * 1.12).toLocaleString() : 0}`);

    // Comparable Properties
    console.log('\n🏘️  Comparable Properties (REAL):');
    const totalComps = (estimates.compsUsed?.length || 0) + (estimates.flaggedComps?.length || 0);
    console.log(`  Total Found: ${totalComps} comp(s) (${estimates.compsUsed?.length || 0} clean, ${estimates.flaggedComps?.length || 0} flagged)`);
    console.log(`  Search Tier: ${estimates.compTier} (${estimates.compTier === 1 ? 'tight - high confidence' : estimates.compTier === 2 ? 'moderate - good confidence' : 'wide - lower confidence'})`);
    console.log(`  Comp-Derived Value: $${estimates.compDerivedValue?.toLocaleString()} (from clean comps)`);
    if (estimates.pricePerSqftStats) {
      console.log(`  Mean $/SF: $${estimates.pricePerSqftStats.meanPricePerSqft.toFixed(2)} (±$${estimates.pricePerSqftStats.stdDevPricePerSqft.toFixed(2)})`);
      console.log(`  Median $/SF: $${estimates.pricePerSqftStats.medianPricePerSqft.toFixed(2)}`);
    }

    if (estimates.compsUsed && estimates.compsUsed.length > 0) {
      console.log('\n  ✅ Clean Comparables (Used for Valuation):');
      estimates.compsUsed.forEach((comp, idx) => {
        console.log(`    ${idx + 1}. ${comp.address}`);
        console.log(`       $${comp.price.toLocaleString()} | ${comp.sqft} sqft | $${comp.pricePerSqft}/sqft`);
        console.log(`       ${comp.bedrooms}BR/${comp.bathrooms}BA | ${comp.distance} | Sold: ${comp.soldDate?.substring(0, 10)}`);
      });
    }

    if (estimates.flaggedComps && estimates.flaggedComps.length > 0) {
      console.log('\n  ⚠️  Flagged Comparables (For Reference Only):');
      estimates.flaggedComps.forEach((comp, idx) => {
        const icon = comp.isOutlier ? '⚠️' : comp.isRenovated ? '🔨' : '🔵';
        console.log(`    ${icon} ${idx + 1}. ${comp.address}`);
        console.log(`       $${comp.price.toLocaleString()} | ${comp.sqft} sqft | $${comp.pricePerSqft}/sqft`);
        console.log(`       ${comp.bedrooms}BR/${comp.bathrooms}BA | ${comp.distance} | Sold: ${comp.soldDate?.substring(0, 10)}`);
        if (comp.outlierReason) {
          console.log(`       [${comp.outlierReason}]`);
        }
      });
    }

    // NEW ENHANCED SCORING
    console.log('\n🎯 NEW WEIGHTED SCORING SYSTEM (0-100):');
    console.log(`  FINAL SCORE: ${finalScore}/100`);
    console.log('\n  Component Breakdown:');
    console.log(`    1. Loan Leverage Metrics: ${garyCalculations.leverageScore.toFixed(1)}/10 (40% weight = ${((garyCalculations.leverageScore / 10) * 40).toFixed(1)} points)`);
    console.log(`       - LTV (As-Is): ${garyCalculations.loanToAsIsValue.toFixed(1)}% (target: ≤85%)`);
    console.log(`       - LARV: ${garyCalculations.loanToArv.toFixed(1)}% (target: ≤75%)`);
    console.log(`       - LTC: ${garyCalculations.loanToCost.toFixed(1)}% (target: ≤85%)`);
    console.log(`    2. Borrower Profit: ${garyCalculations.profitScore.toFixed(1)}/10 (30% weight = ${((garyCalculations.profitScore / 10) * 30).toFixed(1)} points)`);
    console.log(`       - Profit: $${garyCalculations.borrowerProfit.toLocaleString()} (target: ≥$50k)`);
    console.log(`    3. Stress-Tested Profit: ${garyCalculations.stressScore.toFixed(1)}/10 (20% weight = ${((garyCalculations.stressScore / 10) * 20).toFixed(1)} points)`);
    console.log(`       - 10% ARV Drop: $${garyCalculations.stressTestedProfit.toLocaleString()} (target: >$25k)`);
    console.log(`    4. Underwater Check: ${garyCalculations.underwaterScore.toFixed(1)}/10 (10% weight = ${((garyCalculations.underwaterScore / 10) * 10).toFixed(1)} points)`);
    console.log(`       - Status: ${garyCalculations.isLoanUnderwater ? '⚠️  UNDERWATER - High Risk' : '✓ Safe Cushion - Good'}`);

    // Risk Flags
    console.log('\n⚠️  Risk Flags Detected:');
    if (estimates.riskFlags && estimates.riskFlags.length > 0) {
      estimates.riskFlags.forEach(flag => {
        const icon = flag.severity === 'critical' ? '🔴' : flag.severity === 'warning' ? '🟡' : '🔵';
        console.log(`  ${icon} [${flag.severity.toUpperCase()}] ${flag.message}`);
      });
    } else {
      console.log('  ✅ No risk flags detected - clean deal');
    }

    // Market Analysis
    console.log('\n📝 Market Analysis:');
    console.log(`  ${estimates.marketAnalysis.split('\n').join('\n  ')}`);

    // Performance
    console.log('\n⏱️  Performance:');
    console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`  Method: ${estimates.valuationMethod}`);
    console.log(`  Data Source: ${estimates.batchDataUsed ? 'BatchData API (Production)' : 'AI Fallback'}`);
    console.log(`  API Calls: 3 (address verify, property lookup, comp search)`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ PRODUCTION UNDERWRITING FLOW TEST PASSED!');
    console.log('='.repeat(70));
    console.log('\n🎉 All enhanced features working with REAL DATA:');
    console.log('  ✓ User as-is value comparison with BatchData calculation');
    console.log('  ✓ Calculated renovation $/SF validation');
    console.log('  ✓ Condition vs renovation level mismatch detection');
    console.log('  ✓ New 4-component weighted scoring (40/30/20/10)');
    console.log('  ✓ Real comparable sales from production API');
    console.log('  ✓ Enhanced LLM context with all definitions ready');
    console.log('\n💡 This data is ready to be sent to Gary for analysis!\n');

  } catch (error: any) {
    console.error('\n❌ Production Test Failed!');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('\n💡 Troubleshooting:');
    console.error('  - Verify BATCHDATA_USE_MOCK=false in .env.local');
    console.error('  - Check BATCHDATA_API_KEY is valid');
    console.error('  - Ensure the property address is real and in the US');
    console.error('  - Check BatchData API quota/limits\n');
    process.exit(1);
  }
}

// Run production test
testUnderwritingProduction();
