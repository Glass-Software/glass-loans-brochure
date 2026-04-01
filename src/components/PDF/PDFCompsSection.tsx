import React from 'react';
import { View, Text, StyleSheet, Link } from '@react-pdf/renderer';
import {
  PropertyComparable,
  CompSelectionState,
} from '@/types/underwriting';
import { formatCurrency, formatNumber } from '@/lib/underwriting/calculations';
import { BRAND_COLORS, FONT_SIZES, SPACING } from '@/lib/pdf/pdfUtils';

interface PDFCompsSectionProps {
  comps: PropertyComparable[];
  compSelectionState: CompSelectionState[];
}

export default function PDFCompsSection({
  comps,
  compSelectionState,
}: PDFCompsSectionProps) {
  // Filter out removed comps
  const activeComps = comps.filter((comp, index) => {
    const state = compSelectionState.find((s) => s.compIndex === index);
    return !state?.removed;
  });

  // Check if comp is emphasized
  const isEmphasized = (compIndex: number): boolean => {
    const state = compSelectionState.find((s) => s.compIndex === compIndex);
    return state?.emphasized || false;
  };

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Comparable Properties</Text>
        <Text style={styles.subtitle}>
          {activeComps.length} {activeComps.length === 1 ? 'comp' : 'comps'} used
        </Text>
      </View>

      {/* Comp Grid (2 columns) */}
      <View style={styles.compGrid}>
        {activeComps.map((comp, displayIndex) => {
          // Find original index in full comps array
          const originalIndex = comps.findIndex((c) => c === comp);
          const emphasized = isEmphasized(originalIndex);

          return (
            <CompCard
              key={displayIndex}
              comp={comp}
              emphasized={emphasized}
            />
          );
        })}
      </View>
    </View>
  );
}

interface CompCardProps {
  comp: PropertyComparable;
  emphasized: boolean;
}

function CompCard({ comp, emphasized }: CompCardProps) {
  return (
    <View style={[styles.compCard, emphasized && styles.compCardEmphasized]}>
      {/* Emphasized Badge */}
      {emphasized && (
        <View style={styles.emphasizedBadge}>
          <Text style={styles.emphasizedBadgeText}>Emphasized</Text>
        </View>
      )}

      {/* Address */}
      <Text style={styles.compAddress}>{comp.address}</Text>

      {/* Price and $/sqft */}
      <View style={styles.compRow}>
        <View style={styles.compColumn}>
          <Text style={styles.compLabel}>Price</Text>
          <Text style={styles.compValue}>{formatCurrency(comp.price)}</Text>
        </View>
        <View style={styles.compColumn}>
          <Text style={styles.compLabel}>$/sqft</Text>
          <Text style={styles.compValue}>
            {comp.pricePerSqft ? `$${formatNumber(comp.pricePerSqft, 0)}` : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Size and Beds/Baths */}
      <View style={styles.compRow}>
        <View style={styles.compColumn}>
          <Text style={styles.compLabel}>Size</Text>
          <Text style={styles.compValue}>
            {comp.sqft ? `${formatNumber(comp.sqft, 0)} sqft` : 'N/A'}
          </Text>
        </View>
        <View style={styles.compColumn}>
          <Text style={styles.compLabel}>Beds/Baths</Text>
          <Text style={styles.compValue}>
            {comp.bedrooms || 'N/A'} / {comp.bathrooms || 'N/A'}
          </Text>
        </View>
      </View>

      {/* Year Built and Distance */}
      <View style={styles.compRow}>
        <View style={styles.compColumn}>
          <Text style={styles.compLabel}>Year Built</Text>
          <Text style={styles.compValue}>{comp.yearBuilt || 'N/A'}</Text>
        </View>
        <View style={styles.compColumn}>
          <Text style={styles.compLabel}>Distance</Text>
          <Text style={styles.compValue}>{comp.distance || 'N/A'}</Text>
        </View>
      </View>

      {/* Sold Date */}
      {comp.soldDate && (
        <View style={styles.compRow}>
          <View style={styles.compColumn}>
            <Text style={styles.compLabel}>Sold Date</Text>
            <Text style={styles.compValue}>{comp.soldDate}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.heading,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    color: BRAND_COLORS.black,
  },
  subtitle: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.gray,
  },
  compGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  compCard: {
    width: '48%',
    backgroundColor: BRAND_COLORS.white,
    borderWidth: 1,
    borderColor: BRAND_COLORS.lightGray,
    borderRadius: 6,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  compCardEmphasized: {
    borderColor: BRAND_COLORS.success,
    borderWidth: 2,
    backgroundColor: '#F0FDF4', // Very light green
  },
  emphasizedBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: BRAND_COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 3,
  },
  emphasizedBadgeText: {
    fontSize: FONT_SIZES.caption,
    color: BRAND_COLORS.white,
    fontWeight: 'bold',
  },
  compAddress: {
    fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
    marginBottom: SPACING.sm,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  compColumn: {
    flex: 1,
  },
  compLabel: {
    fontSize: FONT_SIZES.caption,
    color: BRAND_COLORS.gray,
    marginBottom: 2,
  },
  compValue: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.darkGray,
    fontWeight: 'bold',
  },
});
