# AI Underwriting Tool - Quick Start Guide

## ✅ Configuration Complete

All API keys have been configured:
- ✅ AbstractAPI: `db348...727e`
- ✅ OpenRouter (Grok): `sk-or-v1-ce878...012c`
- ✅ reCAPTCHA v3: Configured
- ✅ SendGrid: Already configured

## Local Testing (Optional)

### 1. Set Up Local Database

```bash
# Option A: Docker (Recommended)
docker run -d \
  --name glass-loans-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=glass_loans \
  -p 5432:5432 \
  postgres:15

# Update .env.local with:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/glass_loans
```

### 2. Run Migration

```bash
# Connect to database
psql postgresql://postgres:password@localhost:5432/glass_loans

# Inside psql, run:
\i src/lib/db/migrations/001_initial_schema.sql

# Verify tables created:
\dt

# Exit:
\q
```

### 3. Test Locally

```bash
# Install dependencies (if not already)
npm install

# Start dev server
npm run dev

# Visit: http://localhost:3000/underwrite
```

## Production Deployment

### Step 1: Create Persistent Volume

```bash
# Create 1GB volume for SQLite database (~$0.15/month)
fly volumes create glass_loans_data --region dfw --size 1 --app glass-loans-brochure-modified-misty-thunder-1484

# Note: You'll see a warning about creating multiple volumes
# This is fine - you're running a single machine app
```

### Step 2: Set Environment Variables

```bash
# Configure all API keys and secrets
./deploy-secrets.sh
```

### Step 3: Deploy Application

```bash
# Deploy to production
fly deploy

# Monitor deployment
fly logs --app glass-loans-brochure-modified-misty-thunder-1484
```

### Step 4: Run Database Migration

```bash
# SSH into your deployed app
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484

# Run the SQLite migration
cd /app
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('/data/glass-loans.db');
const sql = fs.readFileSync('src/lib/db/migrations/001_initial_schema.sqlite.sql', 'utf8');
db.exec(sql);
console.log('✅ Migration complete!');
db.close();
"

# Verify tables were created
node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/glass-loans.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
console.log('Tables created:', tables);
db.close();
"

exit
```

### Step 4: Set Production Secrets

```bash
# Run the helper script:
./deploy-secrets.sh

# This sets all environment variables including:
# - SendGrid API key
# - AbstractAPI key
# - OpenRouter API key
# - reCAPTCHA keys
# - JWT secret
# - Base URL
```

### Step 5: Deploy Application

```bash
# Deploy to Fly.io
flyctl deploy --app glass-loans-brochure-modified-misty-thunder-1484

# This will:
# 1. Build Docker image
# 2. Push to Fly.io
# 3. Deploy to production
# 4. Health check the app
```

### Step 6: Verify Deployment

```bash
# Check app status
flyctl status --app glass-loans-brochure-modified-misty-thunder-1484

# View logs
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484

# Open in browser
flyctl open --app glass-loans-brochure-modified-misty-thunder-1484

# Visit: /underwrite
```

## Testing in Production

### 1. Complete an Underwriting Submission

1. Visit: `https://glass-loans-brochure-modified-misty-thunder-1484.fly.dev/underwrite`
2. Fill out all 5 form steps:
   - **Step 1**: Property details (address, price, rehab, square feet)
   - **Step 2**: Property condition, renovation level
   - **Step 3**: Loan terms (interest, months, loan amount, etc.)
   - **Step 4**: Market type, optional comp links
   - **Step 5**: Email verification

3. Submit and check email for verification link
4. Click link to view results

### 2. Verify Results Display

Check that you see:
- ✅ Score out of 100
- ✅ Gary's Opinion (AI narrative)
- ✅ Detailed calculation breakdown
- ✅ "Analysis 1 of 3" usage counter
- ✅ All numbers formatted with commas

### 3. Test Usage Limits

- Submit 2 more analyses with the same email
- After 3rd submission, should show "limit reached" message
- 4th attempt should be blocked

### 4. Verify Database

```bash
# SSH into production
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484

# Check users and submissions
node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/glass-loans.db');

console.log('\\nUsers:');
const users = db.prepare('SELECT email, usage_count, email_verified FROM users ORDER BY created_at DESC LIMIT 10').all();
console.table(users);

console.log('\\nRecent Submissions:');
const submissions = db.prepare('SELECT property_address, final_score, recaptcha_score, created_at FROM underwriting_submissions ORDER BY created_at DESC LIMIT 5').all();
console.table(submissions);

db.close();
"
```

## Troubleshooting

### Issue: Database errors

```bash
# Check if database file exists
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484
ls -la /data/glass-loans.db

# If missing, run migration (see Step 4 above)

# Check database tables
node -e "const db = require('better-sqlite3')('/data/glass-loans.db'); console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\\'table\\'').all()); db.close();"

# Restart app
flyctl apps restart glass-loans-brochure-modified-misty-thunder-1484
```

### Issue: Email not sending

```bash
# Check logs for SendGrid errors
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484 | grep -i sendgrid

# Verify SendGrid API key is set
flyctl secrets list --app glass-loans-brochure-modified-misty-thunder-1484 | grep SENDGRID
```

### Issue: AI not working

```bash
# Check OpenRouter logs
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484 | grep -i "openrouter\|grok"

# Verify API key
flyctl secrets list --app glass-loans-brochure-modified-misty-thunder-1484 | grep OPENROUTER

# Check OpenRouter dashboard for quota/errors:
# https://openrouter.ai/activity
```

### Issue: reCAPTCHA errors

```bash
# Check reCAPTCHA keys
flyctl secrets list --app glass-loans-brochure-modified-misty-thunder-1484 | grep RECAPTCHA

# Verify domain is registered in Google reCAPTCHA admin:
# https://www.google.com/recaptcha/admin

# Add fly.dev domain if needed
```

## Monitoring

```bash
# Real-time logs
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484

# App metrics
flyctl status --app glass-loans-brochure-modified-misty-thunder-1484


# Scale if needed
flyctl scale count 2 --app glass-loans-brochure-modified-misty-thunder-1484
```

## Update Production

When you make code changes:

```bash
# 1. Test locally first
npm run dev

# 2. Deploy to production
flyctl deploy --app glass-loans-brochure-modified-misty-thunder-1484

# 3. Monitor deployment
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484
```

## Success Checklist

- [ ] Postgres database created and attached
- [ ] Database migration ran successfully (3 tables created)
- [ ] All secrets configured (use `flyctl secrets list` to verify)
- [ ] App deployed successfully
- [ ] Can access `/underwrite` route in browser
- [ ] Email verification working (receive email with link)
- [ ] AI providing property estimates (check Gary's Opinion)
- [ ] Calculations match Excel formulas
- [ ] Usage limit enforced after 3 submissions
- [ ] reCAPTCHA protecting form (check logs for score)
- [ ] Numbers formatted with commas
- [ ] Mobile responsive

## Next Steps After Launch

1. **Custom Domain** (Optional)
   ```bash
   flyctl certs create yourdomain.com --app glass-loans-brochure-modified-misty-thunder-1484
   ```

2. **Automated Backups**
   ```bash
   # Volume snapshots (automatic by Fly.io)
   fly volumes snapshots list glass_loans_data --app glass-loans-brochure-modified-misty-thunder-1484

   # Manual backup via download
   fly ssh sftp get /data/glass-loans.db ./backups/glass-loans-$(date +%Y%m%d).db --app glass-loans-brochure-modified-misty-thunder-1484
   ```

3. **Monitoring & Alerts**
   - Set up error tracking (Sentry, etc.)
   - Monitor OpenRouter usage/costs
   - Track conversion rates

4. **Update reCAPTCHA Domain**
   - Go to: https://www.google.com/recaptcha/admin
   - Add your custom domain to allowed domains

## Support Files

- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment instructions
- [TESTING.md](TESTING.md) - Complete testing checklist
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Full feature overview
- [.env.example](.env.example) - Environment variables reference

---

**You're ready to deploy!** 🚀

Run the commands above in order, and you'll have a fully functional AI underwriting tool in production.
