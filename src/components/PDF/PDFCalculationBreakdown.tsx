import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  UnderwritingFormData,
  CalculatedResults,
  getRenovationLevel,
} from '@/types/underwriting';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
} from '@/lib/underwriting/calculations';
import { BRAND_COLORS, FONT_SIZES, SPACING } from '@/lib/pdf/pdfUtils';

interface PDFCalculationBreakdownProps {
  formData: UnderwritingFormData;
  calculations: CalculatedResults;
}

export default function PDFCalculationBreakdown({
  formData,
  calculations,
}: PDFCalculationBreakdownProps) {
  return (
    <View style={styles.section} break>
      <Text style={styles.mainTitle}>Detailed Calculations</Text>

      {/* Property Information */}
      <Section title="Property Information">
        <Row label="Address" value={formData.propertyAddress} />
        <Row label="Purchase Price" value={formatCurrency(formData.purchasePrice)} />
        <Row label="Rehab Budget" value={formatCurrency(formData.rehab)} />
        <Row label="Square Feet" value={formatNumber(formData.squareFeet)} />
        {formData.yearBuilt ? <Row label="Year Built" value={String(formData.yearBuilt)} /> : null}
        <Row label="Condition" value={formData.propertyCondition} />
        <Row
          label="Renovation Budget"
          value={`$${Number(formData.renovationPerSf).toFixed(2)}/SF (${getRenovationLevel(Number(formData.renovationPerSf))})`}
        />
        <Row label="Market Type" value={formData.marketType} />
      </Section>

      {/* Loan Terms */}
      <Section title="Loan Terms">
        <Row label="Loan at Purchase" value={formatCurrency(formData.loanAtPurchase)} />
        <Row label="Renovation Funds" value={formatCurrency(formData.renovationFunds || 0)} />
        <Row label="Total Loan Amount" value={formatCurrency(calculations.totalLoanAmount)} highlight />
        <Row label="Interest Rate" value={formatPercentage(formData.interestRate)} />
        <Row label="Loan Term" value={`${formData.months} months`} />
        <Row label="Closing Costs" value={formatPercentage(formData.closingCostsPercent)} />
        <Row label="Points" value={formatPercentage(formData.points)} />
      </Section>

      {/* Financial Analysis */}
      <Section title="Financial Analysis">
        <Row label="Renovation $/SF" value={`$${formatNumber(calculations.renovationDollarPerSf, 2)}/SF`} />
        <Row label="Total Cost (Purchase + Rehab)" value={formatCurrency(calculations.totalCost)} />
        <Row label="Closing Costs ($)" value={formatCurrency(calculations.closingCostsDollar)} />
        <Row label="Points ($)" value={formatCurrency(calculations.pointsDollar)} />
        <Row label="Per Diem Interest" value={formatCurrency(calculations.perDiem)} />
        <Row label="Total Interest" value={formatCurrency(calculations.totalInterest)} />
        <Row label="Total Costs (All In)" value={formatCurrency(calculations.totalCostsOverall)} highlight />
      </Section>

      {/* Borrower Profit Calculation */}
      <Section title="Borrower Profit Calculation">
        {/* Revenue Box */}
        <View style={[styles.box, styles.revenueBox]}>
          <Text style={styles.boxTitle}>Revenue</Text>
          <View style={styles.boxRow}>
            <Text style={styles.boxLabel}>ARV (After Repair Value)</Text>
            <Text style={styles.boxValue}>{formatCurrency(calculations.arv)}</Text>
          </View>
        </View>

        {/* Costs Box */}
        <View style={[styles.box, styles.costsBox]}>
          <Text style={styles.boxTitle}>Costs</Text>
          <View style={styles.boxRow}>
            <Text style={styles.boxLabel}>Purchase Price</Text>
            <Text style={styles.boxValue}>{formatCurrency(formData.purchasePrice)}</Text>
          </View>
          <View style={styles.boxRow}>
            <Text style={styles.boxLabel}>Rehab Budget</Text>
            <Text style={styles.boxValue}>{formatCurrency(formData.rehab)}</Text>
          </View>
          <View style={styles.boxRow}>
            <Text style={styles.boxLabel}>Interest Expense (360-day basis)</Text>
            <Text style={styles.boxValue}>{formatCurrency(calculations.totalInterest)}</Text>
          </View>
          <View style={styles.boxRow}>
            <Text style={styles.boxLabel}>Closing Costs</Text>
            <Text style={styles.boxValue}>{formatCurrency(calculations.closingCostsDollar)}</Text>
          </View>
          <View style={styles.boxRow}>
            <Text style={styles.boxLabel}>Points</Text>
            <Text style={styles.boxValue}>{formatCurrency(calculations.pointsDollar)}</Text>
          </View>
          <View style={[styles.boxRow, styles.totalRow]}>
            <Text style={styles.boxTotalLabel}>Total Costs</Text>
            <Text style={styles.boxTotalValue}>{formatCurrency(calculations.totalCostsOverall)}</Text>
          </View>
        </View>

        {/* Profit Formula Box */}
        <View style={[styles.box, styles.profitBox]}>
          <Text style={styles.profitFormula}>Borrower Profit = Revenue - Costs</Text>
          <Text style={styles.profitValue}>{formatCurrency(calculations.borrowerProfit)}</Text>
          <Text style={styles.profitDetail}>
            = {formatCurrency(calculations.arv)} - {formatCurrency(calculations.totalCostsOverall)}
          </Text>
        </View>

        {/* Stress Tested Box */}
        <View style={[styles.box, styles.stressBox]}>
          <View style={styles.boxRow}>
            <Text style={styles.boxLabel}>Stress Tested Profit (5% ARV drop)</Text>
            <Text style={styles.boxValue}>{formatCurrency(calculations.borrowerProfitStressTested)}</Text>
          </View>
          <Text style={styles.stressDetail}>ARV × 0.95 = {formatCurrency(calculations.arv * 0.95)}</Text>
        </View>

        {/* Underwater Warning */}
        {calculations.isLoanUnderwater && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Loan is underwater on day 1</Text>
          </View>
        )}
      </Section>

      {/* Score Breakdown */}
      <Section title="Score Breakdown (0-100)">
        <ScoreComponent
          label="Loan Leverage Metrics"
          score={calculations.leverageScore}
          weight={40}
          details={`LTV: ${formatPercentage(calculations.loanToAsIsValue)}, LARV: ${formatPercentage(calculations.loanToArv)}, LTC: ${formatPercentage(calculations.loanToCost)}`}
        />
        <ScoreComponent
          label="Borrower Profit"
          score={calculations.profitScore}
          weight={30}
          details={formatCurrency(calculations.borrowerProfit)}
        />
        <ScoreComponent
          label="Stress-Tested Profit (5% ARV drop)"
          score={calculations.stressScore}
          weight={20}
          details={formatCurrency(calculations.stressTestedProfit)}
        />
        <ScoreComponent
          label="Day-One Underwater Check"
          score={calculations.underwaterScore}
          weight={10}
          details={calculations.isLoanUnderwater ? '⚠️ Underwater' : '✓ Safe cushion'}
        />
      </Section>

      {/* Detailed Risk Metrics */}
      <Section title="Detailed Risk Metrics">
        <Row label="Loan to ARV" value={formatPercentage(calculations.loanToArv)} />
        <Row label="Loan to As-Is Value" value={formatPercentage(calculations.loanToAsIsValue)} />
        <Row label="Loan to Cost" value={formatPercentage(calculations.loanToCost)} />
        <Row label="Stress Tested L-ARV (95%)" value={formatPercentage(calculations.stressTestedLArv)} />
        <Row label="Loan Underwater Day 1" value={calculations.isLoanUnderwater ? 'Yes' : 'No'} highlight />
      </Section>
    </View>
  );
}

// Helper Components

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function Row({ label, value, highlight }: RowProps) {
  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

interface ScoreComponentProps {
  label: string;
  score: number;
  weight: number;
  details: string;
}

function ScoreComponent({ label, score, weight, details }: ScoreComponentProps) {
  return (
    <View style={styles.scoreComponent}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>
          {score.toFixed(1)}/10 ({weight}% weight)
        </Text>
      </View>
      <Text style={styles.scoreDetails}>{details}</Text>
    </View>
  );
}

// Styles

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.xl,
  },
  mainTitle: {
    fontSize: FONT_SIZES.heading,
    fontWeight: 'bold',
    marginBottom: SPACING.lg,
    color: BRAND_COLORS.black,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.subheading,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    color: BRAND_COLORS.black,
  },
  sectionContent: {
    gap: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: BRAND_COLORS.lightGray,
    borderRadius: 3,
    marginBottom: SPACING.xs,
  },
  rowHighlight: {
    backgroundColor: BRAND_COLORS.primary + '20',
  },
  rowLabel: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.gray,
    flex: 1,
  },
  rowValue: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.black,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  rowValueHighlight: {
    color: BRAND_COLORS.primary,
  },
  box: {
    borderRadius: 4,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  revenueBox: {
    backgroundColor: BRAND_COLORS.lightGray,
  },
  costsBox: {
    backgroundColor: BRAND_COLORS.lightGray,
  },
  profitBox: {
    backgroundColor: BRAND_COLORS.lightGray,
    alignItems: 'center',
  },
  stressBox: {
    backgroundColor: BRAND_COLORS.white,
    borderWidth: 1,
    borderColor: BRAND_COLORS.lightGray,
  },
  warningBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 4,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  warningText: {
    fontSize: FONT_SIZES.small,
    color: '#DC2626',
  },
  boxTitle: {
    fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    color: BRAND_COLORS.black,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  boxLabel: {
    fontSize: FONT_SIZES.caption,
    color: BRAND_COLORS.gray,
  },
  boxValue: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.black,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: BRAND_COLORS.gray,
    paddingTop: 4,
    marginTop: 4,
  },
  boxTotalLabel: {
    fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
  },
  boxTotalValue: {
    fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
  },
  profitFormula: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.gray,
    marginBottom: SPACING.xs,
  },
  profitValue: {
    fontSize: FONT_SIZES.heading,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
    marginBottom: 4,
  },
  profitDetail: {
    fontSize: FONT_SIZES.caption,
    color: BRAND_COLORS.gray,
  },
  stressDetail: {
    fontSize: FONT_SIZES.caption,
    color: BRAND_COLORS.gray,
    marginTop: 3,
  },
  scoreComponent: {
    backgroundColor: BRAND_COLORS.lightGray,
    borderRadius: 4,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  scoreLabel: {
    fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
  },
  scoreValue: {
    fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    color: BRAND_COLORS.primary,
  },
  scoreDetails: {
    fontSize: FONT_SIZES.caption,
    color: BRAND_COLORS.gray,
  },
});
