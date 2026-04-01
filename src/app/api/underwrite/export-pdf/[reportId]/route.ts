import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { getCurrentUser } from '@/lib/auth/session';
import { getSubmissionByReportId } from '@/lib/db/queries';
import { calculateUnderwriting } from '@/lib/underwriting/calculations';
import UnderwritingReportPDF from '@/components/PDF/UnderwritingReportPDF';
import { sanitizeFilename } from '@/lib/pdf/pdfUtils';
import type {
  UnderwritingFormData,
  CompSelectionState,
  PropertyComparable,
} from '@/types/underwriting';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check Pro tier
    if (user.tier !== 'pro') {
      return NextResponse.json(
        { error: 'PDF export is only available for Pro users' },
        { status: 403 }
      );
    }

    // 3. Get reportId from params
    const { reportId } = await params;

    // 4. Fetch submission
    const submission = await getSubmissionByReportId(reportId);
    if (!submission) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // 5. Verify ownership
    if (submission.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 6. Reconstruct form data (same logic as results page)
    const formData: UnderwritingFormData = {
      propertyAddress: submission.property_address,
      propertyCity: submission.property_city || undefined,
      propertyState: submission.property_state || undefined,
      propertyZip: submission.property_zip || undefined,
      propertyCounty: submission.property_county || undefined,
      propertyLatitude: submission.property_latitude || undefined,
      propertyLongitude: submission.property_longitude || undefined,
      purchasePrice: submission.purchase_price,
      rehab: submission.rehab,
      squareFeet: submission.square_feet,
      bedrooms: submission.bedrooms || 0,
      bathrooms: submission.bathrooms || 0,
      yearBuilt: submission.year_built || 0,
      propertyType: submission.property_type as any,
      propertyCondition: submission.property_condition as any,
      renovationPerSf: Number(submission.renovation_per_sf),
      userEstimatedAsIsValue: submission.user_estimated_as_is_value || 0,
      userEstimatedArv: submission.user_estimated_arv || 0,
      interestRate: submission.interest_rate,
      months: submission.months,
      loanAtPurchase: submission.loan_at_purchase,
      renovationFunds: submission.renovation_funds,
      closingCostsPercent: submission.closing_costs_percent,
      points: submission.points,
      marketType: submission.market_type as any,
      additionalDetails: submission.additional_details || undefined,
    };

    // 7. Parse property comps
    let parsedComps: PropertyComparable[] = [];
    try {
      parsedComps = submission.property_comps
        ? JSON.parse(submission.property_comps)
        : [];
      if (!Array.isArray(parsedComps)) {
        console.error('property_comps is not an array:', parsedComps);
        parsedComps = [];
      }
    } catch (error) {
      console.error('Failed to parse property_comps:', error);
      parsedComps = [];
    }

    // 8. Parse comp selection state
    let compSelectionState: CompSelectionState[] = [];
    try {
      compSelectionState = submission.comp_selection_state
        ? JSON.parse(submission.comp_selection_state)
        : [];
      if (!Array.isArray(compSelectionState)) {
        console.error('comp_selection_state is not an array:', compSelectionState);
        compSelectionState = [];
      }
    } catch (error) {
      console.error('Failed to parse comp_selection_state:', error);
      compSelectionState = [];
    }

    // 9. Calculate Gary's analysis
    const garyCalculations = calculateUnderwriting(
      formData,
      submission.estimated_arv || 0,
      submission.as_is_value || 0
    );

    // 10. Generate PDF filename
    const sanitizedAddress = sanitizeFilename(submission.property_address, 50);
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `GlassLoans_${sanitizedAddress}_${date}.pdf`;

    // 11. Generate PDF using @react-pdf/renderer
    const pdfStream = await renderToStream(
      React.createElement(UnderwritingReportPDF, {
        formData,
        garyCalculations,
        garyAsIsValue: submission.as_is_value || 0,
        finalScore: submission.final_score || 0,
        garyOpinion: submission.gary_opinion || 'No analysis available.',
        comps: parsedComps,
        compSelectionState,
      }) as any
    );

    // 12. Return PDF as downloadable file
    return new NextResponse(pdfStream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
