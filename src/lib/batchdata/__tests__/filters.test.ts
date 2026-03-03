/**
 * Unit tests for filters.ts
 * Run with: npx tsx --test src/lib/batchdata/__tests__/filters.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterComparables } from '../filters';
import type { PropertySearchResult, BatchDataPropertyResponse } from '../types';

// Test fixtures
const createMockSubjectProperty = (): BatchDataPropertyResponse => ({
  address: {
    standardizedAddress: '123 Main St',
    streetNumber: '123',
    streetName: 'Main St',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90001',
    zipPlus4: '',
    county: 'Los Angeles',
    countyFips: '06037',
    latitude: 34.0,
    longitude: -118.0,
    validated: true,
  },
  propertyType: 'Single Family',
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 2000,
  lotSize: 5000,
  yearBuilt: 1980,
  lastSaleDate: '2020-01-01',
  lastSalePrice: 350000,
  taxAssessedValue: 300000,
  taxAssessmentHistory: [],
  mortgageInfo: null,
  liens: [],
  ownerName: 'Test Owner',
  ownerType: 'Individual',
  zoning: 'R1',
  avm: {
    value: 400000,
    confidenceScore: 75,
    valuationDate: '2024-01-01',
    lowEstimate: 380000,
    highEstimate: 420000,
  },
  preForeclosure: false,
});

const createMockComp = (overrides: Partial<PropertySearchResult> = {}): PropertySearchResult => ({
  address: '456 Oak Ave',
  propertyType: 'Single Family',
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 2000,
  lastSaleDate: '2023-06-01',
  lastSalePrice: 400000,
  distance: 0.5,
  daysOnMarket: 30,
  pricePerSqft: 200,
  taxAssessedValue: 320000,
  ...overrides,
});

describe('filterComparables', () => {
  describe('Property Type Filtering', () => {
    it('should flag comps with mismatched property types when strictPropertyType is true', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({ propertyType: 'Single Family' }),
        createMockComp({ propertyType: 'Condo', address: '789 Condo Ln' }),
        createMockComp({ propertyType: 'Townhouse', address: '321 Town St' }),
      ];

      const result = filterComparables(subject, comps, 2000, { strictPropertyType: true });

      assert.equal(result.usedForCalculation.length, 1, 'Should only use matching property type');
      assert.equal(result.flaggedComps.length, 2, 'Should flag mismatched property types');
      assert.ok(
        result.flaggedComps.some(c => c.outlierReason?.toLowerCase().includes('property type')),
        'Should include property type mismatch reason'
      );
    });

    it('should allow mismatched property types when strictPropertyType is false', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({ propertyType: 'Single Family' }),
        createMockComp({ propertyType: 'Condo', address: '789 Condo Ln' }),
      ];

      const result = filterComparables(subject, comps, 2000, { strictPropertyType: false });

      // All should pass property type check (but may be flagged for other reasons)
      const propertyTypeFlagged = result.flaggedComps.filter(c =>
        c.outlierReason?.includes('property type mismatch')
      );
      assert.equal(propertyTypeFlagged.length, 0, 'Should not flag property type when disabled');
    });

    it('should normalize property types correctly', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({ propertyType: 'SFR' }),
        createMockComp({ propertyType: 'Single Family Residential', address: '789 Test St' }),
        createMockComp({ propertyType: 'single_family', address: '321 Test Ave' }),
      ];

      const result = filterComparables(subject, comps, 2000, { strictPropertyType: true });

      // All variants of SFR should be accepted
      assert.equal(
        result.usedForCalculation.length,
        3,
        'Should normalize all SFR variants to match'
      );
    });
  });

  describe('Foreclosure Filtering', () => {
    it('should flag foreclosure properties', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp(),
        createMockComp({ preForeclosure: true, address: '789 Foreclosure St' }),
      ];

      const result = filterComparables(subject, comps, 2000, { excludeForeclosures: true });

      assert.equal(result.usedForCalculation.length, 1, 'Should exclude foreclosures from calculation');
      assert.equal(result.flaggedComps.length, 1, 'Should flag foreclosure');
      assert.ok(
        result.flaggedComps[0].outlierReason?.includes('foreclosure'),
        'Should include foreclosure reason'
      );
    });
  });

  describe('Missing Data Filtering', () => {
    it('should flag comps missing square footage', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp(),
        createMockComp({ squareFeet: 0, address: '789 No Sqft St' }),
      ];

      const result = filterComparables(subject, comps, 2000);

      assert.equal(result.usedForCalculation.length, 1, 'Should exclude comps missing sqft');
      assert.equal(result.flaggedComps.length, 1, 'Should flag missing sqft');
    });

    it('should flag comps missing sale price', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp(),
        createMockComp({ lastSalePrice: 0, address: '789 No Price St' }),
      ];

      const result = filterComparables(subject, comps, 2000);

      assert.equal(result.usedForCalculation.length, 1, 'Should exclude comps missing price');
      assert.equal(result.flaggedComps.length, 1, 'Should flag missing price');
    });
  });

  describe('Statistical Outlier Detection (IQR Method)', () => {
    it('should flag outliers outside IQR bounds (Q1 - 1.5×IQR to Q3 + 1.5×IQR)', () => {
      const subject = createMockSubjectProperty();
      // IQR method: Robust against extreme values
      // Price distribution: $195, $200, $200, $202, $205, $207, $210, $350
      // Q1 (25th %ile) ≈ $200, Q3 (75th %ile) ≈ $207
      // IQR = $7, Lower = $200 - 1.5×$7 = $189.5, Upper = $207 + 1.5×$7 = $217.5
      // $350/sqft should be flagged as outlier (way above $217.5)
      const comps: PropertySearchResult[] = [
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200 }), // $200/sqft
        createMockComp({ lastSalePrice: 410000, squareFeet: 2000, pricePerSqft: 205, address: '2' }), // $205/sqft
        createMockComp({ lastSalePrice: 420000, squareFeet: 2000, pricePerSqft: 210, address: '3' }), // $210/sqft
        createMockComp({ lastSalePrice: 390000, squareFeet: 2000, pricePerSqft: 195, address: '4' }), // $195/sqft
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200, address: '5' }), // $200/sqft
        createMockComp({ lastSalePrice: 415000, squareFeet: 2000, pricePerSqft: 207, address: '6' }), // $207/sqft
        createMockComp({ lastSalePrice: 405000, squareFeet: 2000, pricePerSqft: 202, address: '7' }), // $202/sqft
        createMockComp({ lastSalePrice: 700000, squareFeet: 2000, pricePerSqft: 350, address: '8' }), // $350/sqft - OUTLIER
      ];

      const result = filterComparables(subject, comps, 2000, {
        removeOutliers: true,
        pricePerSqftFilter: false,
        strictPropertyType: false,
        excludeForeclosures: false,
        detectRenovations: false
      });

      assert.ok(result.usedForCalculation.length < comps.length, 'Should flag some outliers');
      assert.ok(
        result.flaggedComps.some(c => c.isOutlier && c.outlierReason?.toLowerCase().includes('iqr')),
        'Should mark outliers with IQR method flag'
      );
      // Verify the $350/sqft comp is flagged
      assert.ok(
        result.flaggedComps.some(c => c.pricePerSqft === 350 && c.isOutlier),
        'Should flag the $350/sqft outlier'
      );
    });

    it('should require at least 4 comps for IQR outlier detection', () => {
      const subject = createMockSubjectProperty();
      // Only 3 comps - IQR method should skip outlier detection
      const comps: PropertySearchResult[] = [
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200 }),
        createMockComp({ lastSalePrice: 410000, squareFeet: 2000, pricePerSqft: 205, address: '2' }),
        createMockComp({ lastSalePrice: 800000, squareFeet: 2000, pricePerSqft: 400, address: '3' }), // Extreme outlier
      ];

      const result = filterComparables(subject, comps, 2000, {
        removeOutliers: true,
        pricePerSqftFilter: false,
        strictPropertyType: false,
        excludeForeclosures: false,
        detectRenovations: false
      });

      // With only 3 comps, IQR method won't flag anything (needs >=4)
      // So all comps should be in usedForCalculation (unless flagged by other filters)
      const outlierFlagged = result.flaggedComps.filter(c =>
        c.outlierReason?.toLowerCase().includes('iqr') ||
        c.outlierReason?.toLowerCase().includes('statistical outlier')
      );
      assert.equal(outlierFlagged.length, 0, 'Should not flag outliers with < 4 comps');
    });

    it('should be robust to extreme outliers (IQR advantage over mean±σ)', () => {
      const subject = createMockSubjectProperty();
      // Multiple extreme outliers that would skew mean/stddev
      // IQR is based on quartiles, so less affected than mean±σ
      // Need enough normal comps so outliers don't affect Q3 (outliers must be < 25% for Q3 to be clean)
      const comps: PropertySearchResult[] = [
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200 }), // Normal
        createMockComp({ lastSalePrice: 410000, squareFeet: 2000, pricePerSqft: 205, address: '2' }), // Normal
        createMockComp({ lastSalePrice: 420000, squareFeet: 2000, pricePerSqft: 210, address: '3' }), // Normal
        createMockComp({ lastSalePrice: 390000, squareFeet: 2000, pricePerSqft: 195, address: '4' }), // Normal
        createMockComp({ lastSalePrice: 405000, squareFeet: 2000, pricePerSqft: 202, address: '5' }), // Normal
        createMockComp({ lastSalePrice: 415000, squareFeet: 2000, pricePerSqft: 207, address: '6' }), // Normal
        createMockComp({ lastSalePrice: 425000, squareFeet: 2000, pricePerSqft: 212, address: '7' }), // Normal
        createMockComp({ lastSalePrice: 395000, squareFeet: 2000, pricePerSqft: 197, address: '8' }), // Normal
        createMockComp({ lastSalePrice: 900000, squareFeet: 2000, pricePerSqft: 450, address: '9' }), // Extreme outlier
        createMockComp({ lastSalePrice: 1000000, squareFeet: 2000, pricePerSqft: 500, address: '10' }), // Extreme outlier
      ];

      const result = filterComparables(subject, comps, 2000, {
        removeOutliers: true,
        pricePerSqftFilter: false,
        strictPropertyType: false,
        excludeForeclosures: false,
        detectRenovations: false
      });

      // IQR should flag both extreme outliers (20% of dataset)
      // Sorted: $195, $197, $200, $202, $205, $207, $210, $212, $450, $500
      // Q1 (index 2) = $200, Q3 (index 7) = $212
      // IQR = $12, Upper = $212 + 1.5×$12 = $230
      // Both $450 and $500 should be flagged
      assert.ok(
        result.flaggedComps.length >= 2,
        'IQR should flag extreme outliers'
      );
      assert.ok(
        result.usedForCalculation.every(c => c.pricePerSqft! < 250),
        'Clean comps should only include normal-priced properties'
      );
    });
  });

  describe('Price Per Sqft Proximity Filtering', () => {
    it('should flag comps with price per sqft diverging more than tolerance', () => {
      const subject = createMockSubjectProperty();
      // Subject AVM: $400k, effective sqft: 2000 → target $200/sqft

      const comps: PropertySearchResult[] = [
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200 }), // On target
        createMockComp({ lastSalePrice: 500000, squareFeet: 2000, pricePerSqft: 250, address: '2' }), // +25% - OK
        createMockComp({ lastSalePrice: 600000, squareFeet: 2000, pricePerSqft: 300, address: '3' }), // +50% - FLAG
        createMockComp({ lastSalePrice: 280000, squareFeet: 2000, pricePerSqft: 140, address: '4' }), // -30% - FLAG
      ];

      const result = filterComparables(subject, comps, 2000, {
        pricePerSqftFilter: true,
        pricePerSqftTolerancePercent: 30,
        removeOutliers: false, // Disable statistical outlier check
        strictPropertyType: false
      });

      assert.ok(
        result.flaggedComps.some(c => c.outlierReason?.toLowerCase().includes('divergence') || c.outlierReason?.toLowerCase().includes('price')),
        'Should flag comps outside tolerance'
      );
    });

    it('should not filter by price when pricePerSqftFilter is false', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200 }),
        createMockComp({ lastSalePrice: 800000, squareFeet: 2000, pricePerSqft: 400, address: '2' }), // +100%
      ];

      const result = filterComparables(subject, comps, 2000, {
        pricePerSqftFilter: false
      });

      const priceFlagged = result.flaggedComps.filter(c =>
        c.outlierReason?.includes('price per sqft divergence')
      );
      assert.equal(priceFlagged.length, 0, 'Should not flag price when disabled');
    });
  });

  describe('Renovation Detection', () => {
    it('should flag likely renovated properties', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({
          lastSalePrice: 400000,
          taxAssessedValue: 380000,
          taxAssessmentRatio: 1.05 // Normal
        }),
        createMockComp({
          lastSalePrice: 500000,
          taxAssessedValue: 300000,
          taxAssessmentRatio: 1.67, // 1.67x tax = likely renovated
          address: '789 Renovated St'
        }),
      ];

      const result = filterComparables(subject, comps, 2000, {
        detectRenovations: true,
        renovationThreshold: 1.5,
        removeOutliers: false,
        pricePerSqftFilter: false,
        strictPropertyType: false
      });

      assert.ok(
        result.flaggedComps.some(c => c.isRenovated && c.outlierReason?.toLowerCase().includes('renovated')),
        'Should flag renovated properties'
      );
    });

    it('should respect renovation threshold configuration', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({
          lastSalePrice: 450000,
          taxAssessedValue: 300000,
          taxAssessmentRatio: 1.5 // Exactly at threshold
        }),
      ];

      // Threshold 1.5
      const result1 = filterComparables(subject, comps, 2000, {
        detectRenovations: true,
        renovationThreshold: 1.5
      });

      // Threshold 2.0
      const result2 = filterComparables(subject, comps, 2000, {
        detectRenovations: true,
        renovationThreshold: 2.0
      });

      assert.ok(
        result2.flaggedComps.length < result1.flaggedComps.length ||
        result2.flaggedComps.length === 0,
        'Higher threshold should flag fewer comps'
      );
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate accurate statistics from clean comps', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200 }),
        createMockComp({ lastSalePrice: 420000, squareFeet: 2000, pricePerSqft: 210, address: '2' }),
        createMockComp({ lastSalePrice: 380000, squareFeet: 2000, pricePerSqft: 190, address: '3' }),
      ];

      const result = filterComparables(subject, comps, 2000);

      assert.ok(result.statistics, 'Should include statistics');
      assert.ok(result.statistics.meanPricePerSqft > 0, 'Should calculate mean');
      assert.ok(result.statistics.medianPricePerSqft > 0, 'Should calculate median');
      assert.ok(result.statistics.stdDevPricePerSqft >= 0, 'Should calculate std dev');

      // Verify median calculation (middle value of sorted list)
      const expectedMedian = 200; // Middle value of [190, 200, 210]
      assert.equal(
        result.statistics.medianPricePerSqft,
        expectedMedian,
        'Should calculate correct median'
      );
    });

    it('should calculate statistics from clean comps only, excluding flagged', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp({ lastSalePrice: 400000, squareFeet: 2000, pricePerSqft: 200 }),
        createMockComp({ lastSalePrice: 410000, squareFeet: 2000, pricePerSqft: 205, address: '2' }),
        createMockComp({ lastSalePrice: 900000, squareFeet: 2000, pricePerSqft: 450, address: '3' }), // Outlier
      ];

      const result = filterComparables(subject, comps, 2000, {
        removeOutliers: true,
        outlierStdDevThreshold: 2.0
      });

      // Statistics should be calculated from clean comps only
      assert.ok(
        result.statistics.meanPricePerSqft < 300,
        'Mean should exclude outlier'
      );
    });
  });

  describe('Flag Summary', () => {
    it('should provide accurate flag summary', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp(),
        createMockComp({ propertyType: 'Condo', address: '2' }), // Type mismatch
        createMockComp({ preForeclosure: true, address: '3' }), // Foreclosure
        createMockComp({ lastSalePrice: 800000, squareFeet: 2000, pricePerSqft: 400, address: '4' }), // Outlier
      ];

      const result = filterComparables(subject, comps, 2000, {
        strictPropertyType: true,
        excludeForeclosures: true,
        removeOutliers: true
      });

      assert.ok(result.flagSummary, 'Should include flag summary');
      assert.equal(
        result.flagSummary.totalFlagged,
        result.flaggedComps.length,
        'Total flagged should match flaggedComps length'
      );
      assert.ok(result.flagSummary.flagReasons, 'Should include flag reasons');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle comps without valuation data gracefully', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        {
          address: '456 Oak Ave',
          propertyType: 'Single Family',
          bedrooms: 3,
          bathrooms: 2,
          squareFeet: 2000,
          lastSaleDate: '2023-06-01',
          lastSalePrice: 400000,
          distance: 0.5,
          // No avm, taxAssessedValue, pricePerSqft, etc.
        },
      ];

      const result = filterComparables(subject, comps, 2000);

      assert.ok(result.allComps.length > 0, 'Should process comps without valuation data');
      // Comps without pricePerSqft will be flagged as missing data (expected behavior)
      assert.ok(
        result.flaggedComps.some(c => c.outlierReason?.toLowerCase().includes('missing')),
        'Should flag comps missing pricePerSqft'
      );
    });
  });

  describe('All Comps Preserved', () => {
    it('should preserve all comps in allComps array', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp(),
        createMockComp({ preForeclosure: true, address: '2' }),
        createMockComp({ propertyType: 'Condo', address: '3' }),
      ];

      const result = filterComparables(subject, comps, 2000, {
        strictPropertyType: true,
        excludeForeclosures: true
      });

      assert.equal(
        result.allComps.length,
        comps.length,
        'Should preserve all comps in allComps array'
      );
      assert.equal(
        result.usedForCalculation.length + result.flaggedComps.length,
        comps.length,
        'Clean + flagged should equal total comps'
      );
    });
  });

  describe('Default Configuration', () => {
    it('should use sensible defaults when no config provided', () => {
      const subject = createMockSubjectProperty();
      const comps: PropertySearchResult[] = [
        createMockComp(),
        createMockComp({ address: '2' }),
      ];

      const result = filterComparables(subject, comps, 2000);

      assert.ok(result.allComps, 'Should process with default config');
      assert.ok(result.usedForCalculation, 'Should have clean comps');
      assert.ok(result.statistics, 'Should calculate statistics');
    });
  });
});

console.log('✅ All filter tests completed!');
