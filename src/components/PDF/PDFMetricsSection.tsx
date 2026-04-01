import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { CalculatedResults } from '@/types/underwriting';
import { formatCurrency, formatPercentage } from '@/lib/underwriting/calculations';
import { getScoreColor, BRAND_COLORS, FONT_SIZES, SPACING } from '@/lib/pdf/pdfUtils';

interface PDFMetricsSectionProps {
  propertyAddress: string;
  score: number;
  garyCalculations: CalculatedResults;
  garyAsIsValue: number;
}

export default function PDFMetricsSection({
  propertyAddress,
  score,
  garyCalculations,
  garyAsIsValue,
}: PDFMetricsSectionProps) {
  const scoreColor = getScoreColor(score);

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Underwriting Analysis</Text>
        <Text style={styles.subtitle}>{propertyAddress}</Text>
      </View>

      {/* Score Badge */}
      <View style={styles.scoreBadge}>
        <Text style={styles.scoreLabel}>Gary's Score</Text>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
      </View>

      {/* Metrics */}
      <View style={styles.metricsContainer}>
        <Text style={styles.sectionTitle}>Gary's Analysis</Text>

        <MetricRow label="As-is Value" value={formatCurrency(garyAsIsValue)} />
        <MetricRow label="After Repair Value" value={formatCurrency(garyCalculations.arv)} />
        <MetricRow
          label="Loan to As-is Value"
          value={formatPercentage(garyCalculations.loanToAsIsValue)}
        />
        <MetricRow
          label="Loan to ARV"
          value={formatPercentage(garyCalculations.loanToArv)}
        />
        <MetricRow
          label="Borrower Profit"
          value={formatCurrency(garyCalculations.borrowerProfit)}
        />
        <MetricRow
          label="Stress-Tested Profit"
          value={formatCurrency(garyCalculations.borrowerProfitStressTested)}
          subtitle="(5% ARV drop)"
        />
        <MetricRow
          label="Is the Loan Underwater Day 1?"
          value={garyCalculations.isLoanUnderwater ? "Yes" : "No"}
        />
      </View>
    </View>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  subtitle?: string;
}

function MetricRow({ label, value, subtitle }: MetricRowProps) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabel}>
        <Text style={styles.metricLabelText}>
          {label}
          {subtitle && <Text style={styles.metricSubtitle}> {subtitle}</Text>}
        </Text>
      </View>
      <View style={styles.metricValue}>
        <Text style={styles.metricValueText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.heading,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    color: BRAND_COLORS.black,
  },
  subtitle: {
    fontSize: FONT_SIZES.body,
    color: BRAND_COLORS.gray,
  },
  scoreBadge: {
    alignSelf: 'center',
    backgroundColor: BRAND_COLORS.lightGray,
    borderRadius: 8,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    minWidth: 120,
  },
  scoreLabel: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.gray,
    marginBottom: SPACING.xs,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  metricsContainer: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.subheading,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: BRAND_COLORS.black,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: BRAND_COLORS.lightGray,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    borderRadius: 4,
  },
  metricLabel: {
    flex: 1,
  },
  metricLabelText: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.gray,
  },
  metricSubtitle: {
    fontSize: FONT_SIZES.caption,
    color: BRAND_COLORS.gray,
    opacity: 0.7,
  },
  metricValue: {
    marginLeft: SPACING.md,
  },
  metricValueText: {
    fontSize: FONT_SIZES.body,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
  },
});
