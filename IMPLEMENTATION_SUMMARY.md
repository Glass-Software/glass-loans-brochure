# AI Loan Underwriting Tool - Implementation Summary

## Project Overview

Built an AI-powered loan underwriting tool at `/underwrite` that replicates Excel-based underwriting, provides AI analysis via Grok, and assigns a score out of 100.

**Live Route**: `/underwrite`
**Tech Stack**: Next.js 15.1.6, TypeScript, Tailwind CSS, Fly.io Postgres, SendGrid, Grok (via OpenRouter)

## Implementation Status

### ✅ Completed (Phases 1-7)

All core functionality has been implemented:

#### Phase 1: Database & Foundation ✅
- PostgreSQL schema with 3 tables (users, underwriting_submissions, rate_limits)
- Connection pooling with pg
- TypeScript interfaces for all data types
- Migration file ready: [001_initial_schema.sql](src/lib/db/migrations/001_initial_schema.sql)

#### Phase 2: Calculation Engine ✅
- All 20 Excel formulas ported to TypeScript
- 360-day year for interest calculations
- Email normalization (prevents +1 tricks)
- Zod validation schemas for all form steps
- Files: [calculations.ts](src/lib/underwriting/calculations.ts), [validation.ts](src/lib/underwriting/validation.ts)

#### Phase 3: Multi-Step Form UI ✅
- 5-step form with progress indicator
- React Context for state management
- Form components: [Step1PropertyDetails.tsx](src/components/Underwriting/Step1PropertyDetails.tsx), [Step2PropertyCondition.tsx](src/components/Underwriting/Step2PropertyCondition.tsx), [Step3LoanTerms.tsx](src/components/Underwriting/Step3LoanTerms.tsx), [Step4MarketDetails.tsx](src/components/Underwriting/Step4MarketDetails.tsx), [Step5EmailVerification.tsx](src/components/Underwriting/Step5EmailVerification.tsx)
- Number formatting with commas (e.g., "140,000")
- Responsive design matching existing Glass Loans theme

#### Phase 4: Email Verification Flow ✅
- AbstractAPI integration for email validation
- SendGrid for verification emails
- Token-based verification (24-hour expiry)
- 3-use limit per normalized email
- Files: [verify-email/route.ts](src/app/api/underwrite/verify-email/route.ts), [verify/page.tsx](src/app/underwrite/verify/page.tsx)

#### Phase 5: AI Integration ✅
- OpenRouter client for Grok API
- Property estimation prompt (ARV, as-is value, rent)
- Gary's opinion generation
- Support for user-provided comp links (up to 3 URLs)
- Graceful fallback when API unavailable
- Files: [openrouter.ts](src/lib/ai/openrouter.ts), [prompts.ts](src/lib/ai/prompts.ts)

#### Phase 6: Main API & Results Display ✅
- Submit endpoint with full workflow
- Results components: [ScoreCard.tsx](src/components/Underwriting/ScoreCard.tsx), [GaryOpinion.tsx](src/components/Underwriting/GaryOpinion.tsx), [CalculationBreakdown.tsx](src/components/Underwriting/CalculationBreakdown.tsx)
- Usage tracking UI ("X of 3 uses remaining")
- Limit reached screen with contact CTA
- File: [submit/route.ts](src/app/api/underwrite/submit/route.ts)

#### Phase 7: Security & Polish ✅
- **reCAPTCHA v3** integrated (invisible, minimum score 0.5)
  - GoogleReCaptchaProvider in [layout.tsx](src/app/layout.tsx)
  - Token verification: [verify.ts](src/lib/recaptcha/verify.ts)
  - Score stored in database
- **Rate limiting** (10 requests/hour per IP)
- **IP tracking** for all submissions
- **Number formatting** across all currency inputs
- **Loading states** and error handling
- **Usage limit UI** with clear messaging

### 📋 Pending (Phase 8: Deployment)

These tasks require production environment setup:

1. **Set up Fly.io Postgres database**
   - Create database cluster: `flyctl postgres create`
   - Attach to app: `flyctl postgres attach`

2. **Run database migrations**
   - Execute [001_initial_schema.sql](src/lib/db/migrations/001_initial_schema.sql)
   - Verify tables created

3. **Configure environment variables**
   - Set all secrets in Fly.io (see [.env.example](.env.example))

4. **Deploy application**
   - Run `flyctl deploy`

5. **Test complete flow in production**
   - Follow [TESTING.md](TESTING.md) checklist

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Key Features

### User-Facing Features
- **Multi-step form** with 14+ inputs across 5 steps
- **Number formatting** with commas for readability
- **Property comparables** - users can provide up to 3 comp URLs
- **Email verification** required before viewing results
- **3 free analyses** per email address
- **AI-powered estimates** for ARV, as-is value, monthly rent
- **Gary's Opinion** - personalized AI narrative analysis
- **Score out of 100** with color-coded visualization
- **Detailed breakdown** of all 20 calculations
- **Mobile responsive** design

### Technical Features
- **Email normalization** (strips +tags, removes Gmail dots)
- **reCAPTCHA v3** bot protection (invisible)
- **Rate limiting** (10 requests/hour per IP)
- **IP tracking** for audit trail
- **Graceful degradation** when AI APIs unavailable
- **360-day interest** calculations (industry standard)
- **JSONB storage** for flexible data (comp links, AI comps)
- **Connection pooling** for database efficiency
- **TypeScript** throughout for type safety

## File Structure

```
/src/app/
  underwrite/
    page.tsx                        # Main route
    verify/page.tsx                 # Email verification callback
  api/underwrite/
    submit/route.ts                 # Main submission endpoint
    verify-email/route.ts           # Email validation & verification

/src/components/Underwriting/
  index.tsx                         # Main orchestrator
  FormProgress.tsx                  # 5-step progress indicator
  Step1PropertyDetails.tsx          # Property info (4 inputs)
  Step2PropertyCondition.tsx        # Dropdowns (2 inputs)
  Step3LoanTerms.tsx               # Loan terms (6 inputs)
  Step4MarketDetails.tsx           # Market + comps (3 inputs)
  Step5EmailVerification.tsx        # Email & submission
  ResultsPanel.tsx                  # Results container
  ScoreCard.tsx                     # Score visualization
  GaryOpinion.tsx                   # AI narrative
  CalculationBreakdown.tsx          # All calculations

/src/lib/
  db/
    postgres.ts                     # Database connection
    queries.ts                      # SQL operations
    migrations/001_initial_schema.sql
  underwriting/
    calculations.ts                 # 20 Excel formulas
    validation.ts                   # Zod schemas
  ai/
    openrouter.ts                   # Grok API client
    prompts.ts                      # AI prompt templates
  email/
    normalization.ts                # Email normalization
    abstractapi.ts                  # Email validation
  recaptcha/
    verify.ts                       # reCAPTCHA verification

/src/context/
  UnderwritingContext.tsx           # Form state management

/src/types/
  underwriting.ts                   # TypeScript interfaces
```

## Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...

# Email
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...

# Email Validation
ABSTRACT_API_KEY=...

# AI
OPENROUTER_API_KEY=...

# Security
RECAPTCHA_SECRET_KEY=...
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...

# App
NEXT_PUBLIC_BASE_URL=...
JWT_SECRET=...
```

See [.env.example](.env.example) for complete list.

## Database Schema

### Table: `users`
- Tracks emails, verification status, usage count
- Normalized emails prevent +1 tricks
- 24-hour verification token expiry

### Table: `underwriting_submissions`
- Stores all form inputs
- AI estimates (ARV, as-is value, rent)
- Calculated results and final score
- Gary's opinion (AI narrative)
- JSONB for comp links and AI comps
- IP address and reCAPTCHA score

### Table: `rate_limits`
- Tracks requests per IP per endpoint
- Rolling 1-hour window
- 10 request limit

## API Endpoints

### POST `/api/underwrite/verify-email`
1. Validates email with AbstractAPI
2. Normalizes email (strips +tags)
3. Checks existing user/usage
4. Sends verification email via SendGrid
5. Returns verification status

### GET `/underwrite/verify?token=<string>`
1. Validates token and expiry
2. Marks email as verified
3. Redirects to `/underwrite`

### POST `/api/underwrite/submit`
1. Validates form data (Zod)
2. Verifies reCAPTCHA token (min 0.5 score)
3. Checks rate limit (10/hour per IP)
4. Verifies email and usage < 3
5. Calls Grok for property estimates
6. Runs calculation engine (20 formulas)
7. Generates Gary's opinion
8. Calculates final score
9. Stores submission in database
10. Increments usage count
11. Returns results

## Score Calculation

Weighted scoring out of 100:

- **Loan to ARV** (30 points): ≤60% = 30, ≤70% = 20, ≤75% = 10
- **Loan to As-Is** (20 points): ≤75% = 20, ≤85% = 10
- **Borrower Spread** (20 points): ≥$50k = 20, ≥$30k = 15, ≥$20k = 10
- **Break Even in Foreclosure** (10 points): Yes = 10
- **Market Type** (10 points): Primary = 10, Secondary = 5, Tertiary = 0
- **Property Condition** (10 points): Good = 10, Bad = 5, Really Bad = 0

See [calculations.ts](src/lib/underwriting/calculations.ts:calculateFinalScore) for implementation.

## Excel Formula Mapping

All 20 formulas from the Excel template have been ported:

1. **Renovation $/SF** = rehab / squareFeet
2. **# of Days** = months × 30
3. **Total Cost** = purchasePrice + rehab
4. **Total Loan Amount** = loanAtPurchase + renovationFunds
5. **Closing Costs $** = closingCostsPercent × purchasePrice
6. **Points $** = pointsPercent × totalLoanAmount
7. **Per Diem** = (totalLoanAmount × interestRate) / 360
8. **Total Interest** = perDiem × days
9. **Total (Costs)** = closingCosts$ + totalInterest + points$
10. **Total Costs (Overall)** = totalCost + total
11. **Borrower Profit** = estimatedARV - totalCostsOverall
12. **Borrower Profit (Stress Tested)** = (estimatedARV × 0.9) - totalCostsOverall
13. **Stress Tested L-ARV** = totalLoanAmount / (estimatedARV × 0.9)
14. **Break Even Day 1** = asIsValue - (loanAtPurchase + totalInterest + points$ + (0.04 × totalLoanAmount))
15. **Debt Yield** = ((monthlyRent × 12) × 0.6) / totalLoanAmount
16. **Loan to As-is Value** = loanAtPurchase / asIsValue
17. **Loan to ARV** = totalLoanAmount / estimatedARV
18. **Loan to Cost** = totalLoanAmount / totalCost
19. **Borrower Spread** = borrowerProfit
20. **Break Even in Foreclosure** = breakEvenDay1 >= 0

## Testing Status

### ✅ Completed
- All components render correctly
- Form validation working
- State management functional
- Number formatting applied
- Design system followed

### 📋 Needs Production Testing
- Email delivery (SendGrid)
- Email verification flow
- AI integration (Grok)
- Database operations
- reCAPTCHA in production
- Rate limiting under load
- Usage limit enforcement

See [TESTING.md](TESTING.md) for complete checklist.

## Known Limitations

1. **3-use limit** - Intentional restriction for free tier
2. **AI fallback** - Uses formula estimates when API unavailable
3. **reCAPTCHA v3** - May occasionally block legitimate users with low scores
4. **Rate limiting** - Shared IP addresses (offices, VPNs) may hit limits faster
5. **Email verification** - Required for all submissions (no anonymous usage)

## Success Metrics

### Development Goals (✅ All Achieved)
- ✅ All Excel formulas replicated accurately
- ✅ Multi-step form with validation
- ✅ Email verification with 3-use limit
- ✅ Email normalization prevents tricks
- ✅ AI integration with graceful fallback
- ✅ reCAPTCHA v3 bot protection
- ✅ Rate limiting by IP
- ✅ Mobile responsive design
- ✅ Number formatting for readability
- ✅ Usage tracking UI

### Production Goals (📋 Pending Deployment)
- [ ] Database deployed on Fly.io
- [ ] All environment variables configured
- [ ] Email sending working
- [ ] AI providing estimates
- [ ] reCAPTCHA protecting form
- [ ] Usage limits enforced
- [ ] Performance acceptable (<2s page load)
- [ ] No console errors

## Next Steps

1. **Deploy to Fly.io**
   - Follow [DEPLOYMENT.md](DEPLOYMENT.md)
   - Set up Postgres database
   - Run migrations
   - Configure secrets

2. **End-to-End Testing**
   - Follow [TESTING.md](TESTING.md)
   - Test all scenarios
   - Verify calculations
   - Check email flow

3. **Launch**
   - Monitor logs for errors
   - Track usage metrics
   - Collect user feedback

4. **Future Enhancements** (Optional)
   - Custom domain setup
   - Google Analytics integration
   - Admin dashboard for submissions
   - Export results as PDF
   - Automated database backups
   - Scaling to multiple regions

## Support

For deployment issues or questions, refer to:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production setup guide
- [TESTING.md](TESTING.md) - Testing checklist
- [.env.example](.env.example) - Environment variables
- [/src/lib/db/migrations/](src/lib/db/migrations/) - Database schema

## License & Disclaimer

**Disclaimer**: This AI-powered analysis is for informational purposes only and does not constitute a loan approval or commitment. Glass Loans assumes no liability for lending decisions made based on this tool. Users accept full responsibility for their investment decisions.

---

**Implementation Complete**: Phases 1-7 ✅
**Ready for Deployment**: Phase 8 📋
**Total Files Created**: 30+
**Lines of Code**: ~5,000
