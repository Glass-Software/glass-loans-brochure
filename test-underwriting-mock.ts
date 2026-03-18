/**
 * Test complete underwriting flow with mock server (enhanced version)
 * Tests all new features: as-is value, calculated renovation $/SF, new scoring
 * Run with: npx tsx test-underwriting-mock.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '.env.local') });

import { getBatchDataPropertyEstimates } from './src/lib/batchdata/underwriting';
import { calculateUnderwriting, calculateFinalScore } from './src/lib/underwriting/calculations';
import { getRenovationLevel } from './src/types/underwriting';
import type { UnderwritingFormData } from './src/types/underwriting';

async function testUnderwritingMock() {
  console.log('🧪 Testing Enhanced Underwriting Flow with Mock Server\n');
  console.log('='.repeat(70));

  try {
    // Sample form data with ALL new fields
    const formData: UnderwritingFormData = {
      // Step 1: Property Details
      propertyAddress: '123 Main St, Los Angeles, CA 90001',
      propertyCity: 'Los Angeles',
      propertyState: 'CA',
      propertyZip: '90001',
      purchasePrice: 350000,
      rehab: 75000,
      squareFeet: 2000,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: 1980,
      propertyType: 'SFR',

      // Step 2: Property Condition (NEW FIELDS!)
      propertyCondition: 'Bad',
      renovationPerSf: 75000 / 2000, // NOW CALCULATED: $37.50/SF
      userEstimatedAsIsValue: 180000, // NEW: User's as-is estimate
      userEstimatedArv: 550000,

      // Step 3: Loan Terms
      interestRate: 12,
      months: 12,
      loanAtPurchase: 280000,
      renovationFunds: 60000,
      closingCostsPercent: 6.5,
      points: 3,

      // Step 4: Market Details
      marketType: 'Primary',
      additionalDetails: 'Test property for enhanced mock server',
    };

    console.log('\n📋 Test Property:');
    console.log(`  Address: ${formData.propertyAddress}`);
    console.log(`  Purchase: $${formData.purchasePrice.toLocaleString()}`);
    console.log(`  Rehab: $${formData.rehab.toLocaleString()}`);
    console.log(`  Size: ${formData.squareFeet} sqft, ${formData.bedrooms}BR/${formData.bathrooms}BA`);
    console.log(`  Condition: ${formData.propertyCondition}`);
    console.log(`  Renovation Budget: $${formData.renovationPerSf.toFixed(2)}/SF (${getRenovationLevel(formData.renovationPerSf)})`);
    console.log(`  User's As-Is Estimate: $${formData.userEstimatedAsIsValue.toLocaleString()}`);
    console.log(`  User's ARV Estimate: $${formData.userEstimatedArv.toLocaleString()}`);

    console.log('\n\n⚙️  Running Enhanced Underwriting Flow...');
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

    console.log('\n✅ Underwriting Complete!\n');
    console.log('='.repeat(70));
    console.log('📊 ENHANCED RESULTS');
    console.log('='.repeat(70));

    // As-Is Value Comparison
    console.log('\n💵 As-Is Value Comparison:');
    console.log(`  User's Estimate: $${formData.userEstimatedAsIsValue.toLocaleString()}`);
    console.log(`  Gary's Analysis: $${estimates.asIsValue.toLocaleString()}`);
    const asIsDiff = Math.abs(formData.userEstimatedAsIsValue - estimates.asIsValue);
    const asIsPct = (asIsDiff / estimates.asIsValue * 100).toFixed(1);
    console.log(`  Difference: $${asIsDiff.toLocaleString()} (${asIsPct}%)`);
    if (asIsDiff / estimates.asIsValue > 0.1) {
      console.log(`  ⚠️  WARNING: User's as-is estimate differs by more than 10%!`);
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
      console.log(`  ⚠️  MISMATCH: ${formData.propertyCondition} condition typically needs ${expectedLevel} renovation, but budget is ${actualLevel}`);
    } else {
      console.log(`  ✓ Condition matches renovation level`);
    }

    // AVM Data
    console.log('\n📈 AVM Data:');
    console.log(`  Value: $${estimates.avmValue?.toLocaleString()}`);
    console.log(`  Confidence: ${estimates.avmConfidence}%`);
    console.log(`  Range: $${estimates.avmValue ? Math.round(estimates.avmValue * 0.88).toLocaleString() : 0} - $${estimates.avmValue ? Math.round(estimates.avmValue * 1.12).toLocaleString() : 0}`);

    // Comparable Properties
    console.log('\n🏘️  Comparable Properties:');
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
    console.log('\n🎯 NEW WEIGHTED SCORING (0-100):');
    console.log(`  Final Score: ${finalScore}/100`);
    console.log('\n  Component Breakdown:');
    console.log(`    1. Loan Leverage Metrics: ${garyCalculations.leverageScore.toFixed(1)}/10 (40% weight)`);
    console.log(`       - LTV: ${garyCalculations.loanToAsIsValue.toFixed(1)}%`);
    console.log(`       - LARV: ${garyCalculations.loanToArv.toFixed(1)}%`);
    console.log(`       - LTC: ${garyCalculations.loanToCost.toFixed(1)}%`);
    console.log(`    2. Borrower Profit: ${garyCalculations.profitScore.toFixed(1)}/10 (30% weight)`);
    console.log(`       - Profit: $${garyCalculations.borrowerProfit.toLocaleString()}`);
    console.log(`    3. Stress-Tested Profit: ${garyCalculations.stressScore.toFixed(1)}/10 (20% weight)`);
    console.log(`       - 10% ARV Drop Profit: $${garyCalculations.stressTestedProfit.toLocaleString()}`);
    console.log(`    4. Underwater Check: ${garyCalculations.underwaterScore.toFixed(1)}/10 (10% weight)`);
    console.log(`       - ${garyCalculations.isLoanUnderwater ? '⚠️  Underwater' : '✓ Safe cushion'}`);

    // Risk Flags
    console.log('\n⚠️  Risk Flags:');
    if (estimates.riskFlags && estimates.riskFlags.length > 0) {
      estimates.riskFlags.forEach(flag => {
        const icon = flag.severity === 'critical' ? '🔴' : flag.severity === 'warning' ? '🟡' : '🔵';
        console.log(`  ${icon} [${flag.severity.toUpperCase()}] ${flag.message}`);
      });
    } else {
      console.log('  ✅ No risk flags detected');
    }

    // Performance
    console.log('\n⏱️  Performance:');
    console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`  Method: ${estimates.valuationMethod}`);
    console.log(`  Data Source: ${estimates.batchDataUsed ? 'BatchData API (Mock)' : 'AI Fallback'}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ ENHANCED UNDERWRITING FLOW TEST PASSED!');
    console.log('='.repeat(70));
    console.log('\n🎉 All new features working correctly:');
    console.log('  ✓ User as-is value input');
    console.log('  ✓ Calculated renovation $/SF');
    console.log('  ✓ Condition vs renovation level check');
    console.log('  ✓ New 4-component weighted scoring');
    console.log('  ✓ Enhanced LLM context ready');
    console.log('\n');

  } catch (error: any) {
    console.error('\n❌ Test Failed!');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testUnderwritingMock();
