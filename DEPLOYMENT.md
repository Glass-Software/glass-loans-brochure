# AI Underwriting Tool - Deployment Guide

## Prerequisites

- Fly.io CLI installed (`brew install flyctl` or `curl -L https://fly.io/install.sh | sh`)
- Fly.io account authenticated (`flyctl auth login`)
- All API keys and environment variables ready (see `.env.example`)

## Phase 8: Testing & Deployment

### 1. Set Up Fly.io Postgres Database

The app is already configured in `fly.toml` as: `glass-loans-brochure-modified-misty-thunder-1484`

#### Create Postgres Database

```bash
# Create a new Postgres cluster
fly mpg create --name glass-loans-db --region dfw

# This will output connection details. Save these!
```

#### Attach Database to App

```bash
# Attach the database to your app
fly mpg attach glass-loans-db --app glass-loans-brochure-modified-misty-thunder-1484

# This automatically sets DATABASE_URL in your app's secrets
```

### 2. Run Database Migrations

#### Option A: Via Fly.io Console

```bash
# SSH into your Fly.io app
flyctl ssh console --app glass-loans-brochure-modified-misty-thunder-1484

# Once inside, run the migration
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('/app/src/lib/db/migrations/001_initial_schema.sql', 'utf8');
pool.query(sql).then(() => {
  console.log('Migration complete!');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
"
```

#### Option B: Via psql (Recommended)

```bash
# Get database connection string
fly mpg connect -a glass-loans-db

# Inside psql, run the migration file
\i /path/to/src/lib/db/migrations/001_initial_schema.sql

# Or copy-paste the SQL from the file
```

#### Option C: Via Migration Script

Create a migration script:

```bash
# Create a one-time migration script
cat > migrate.js << 'EOF'
const { Pool } = require('pg');
const fs = require('fs');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const sql = fs.readFileSync('./src/lib/db/migrations/001_initial_schema.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
EOF

# Run locally against production database (after setting DATABASE_URL)
node migrate.js

# Or run via Fly.io
flyctl ssh console --app glass-loans-brochure-modified-misty-thunder-1484 -C "node /app/migrate.js"
```

### 3. Configure Environment Variables

Set all required secrets in Fly.io:

```bash
# Set environment variables
flyctl secrets set \
  SENDGRID_API_KEY="your_key" \
  SENDGRID_FROM_EMAIL="info@glassloans.io" \
  CONTACT_EMAIL="info@glassloans.io" \
  ABSTRACT_API_KEY="your_key" \
  OPENROUTER_API_KEY="your_key" \
  RECAPTCHA_SECRET_KEY="your_key" \
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY="your_key" \
  JWT_SECRET="your_random_32char_secret" \
  NEXT_PUBLIC_BASE_URL="https://glass-loans-brochure-modified-misty-thunder-1484.fly.dev" \
  --app glass-loans-brochure-modified-misty-thunder-1484

# DATABASE_URL is already set from postgres attach
```

### 4. Deploy the Application

```bash
# Deploy to Fly.io
flyctl deploy --app glass-loans-brochure-modified-misty-thunder-1484

# Monitor deployment
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484
```

### 5. Verify Database Connection

```bash
# Check if the app can connect to the database
flyctl ssh console --app glass-loans-brochure-modified-misty-thunder-1484

# Inside the console, test database connection
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(res => {
  console.log('✅ Database connected:', res.rows[0]);
  process.exit(0);
}).catch(err => {
  console.error('❌ Database connection failed:', err);
  process.exit(1);
});
"
```

## Testing the Complete Flow

### 1. Test Email Verification

1. Visit: `https://your-app.fly.dev/underwrite`
2. Complete all 4 form steps with valid data
3. Enter your email on Step 5
4. Check email for verification link
5. Click verification link
6. Verify you're redirected back to `/underwrite`

### 2. Test Underwriting Submission

After email verification:

1. Complete the form again
2. Submit and verify results display:
   - Score out of 100
   - Gary's Opinion (AI narrative)
   - All calculated metrics
   - Property comps (if AI is configured)

### 3. Test Usage Limits

1. Submit 3 underwriting analyses with the same email
2. Verify the 4th attempt shows usage limit error
3. Check database to confirm usage_count = 3

```sql
SELECT email, usage_count FROM users ORDER BY created_at DESC LIMIT 5;
```

### 4. Test reCAPTCHA

Check the browser console for reCAPTCHA errors. Verify in Fly.io logs:

```bash
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484
# Look for: "reCAPTCHA verified with score: X.XX"
```

### 5. Test Rate Limiting

Make 10+ submissions from the same IP within an hour and verify rate limit error appears.

### 6. Test Number Formatting

Verify all currency inputs display with commas (e.g., "140,000" not "140000")

## Database Queries for Testing

```sql
-- Check users table
SELECT * FROM users ORDER BY created_at DESC LIMIT 10;

-- Check submissions
SELECT
  u.email,
  s.property_address,
  s.final_score,
  s.created_at
FROM underwriting_submissions s
JOIN users u ON s.user_id = u.id
ORDER BY s.created_at DESC
LIMIT 10;

-- Check rate limits
SELECT * FROM rate_limits ORDER BY window_start DESC LIMIT 10;

-- Verify migrations ran
\dt
-- Should show: users, underwriting_submissions, rate_limits
```

## Troubleshooting

### Database Connection Issues

```bash
# Check DATABASE_URL is set
flyctl secrets list --app glass-loans-brochure-modified-misty-thunder-1484

# Test connection from local machine
psql "$DATABASE_URL"
```

### Email Not Sending

```bash
# Check SendGrid API key
flyctl secrets list --app glass-loans-brochure-modified-misty-thunder-1484 | grep SENDGRID

# Check logs for email errors
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484 | grep -i sendgrid
```

### AI Not Working

```bash
# Verify OpenRouter API key
flyctl secrets list --app glass-loans-brochure-modified-misty-thunder-1484 | grep OPENROUTER

# Check logs for AI errors
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484 | grep -i "AI\|openrouter\|grok"
```

### reCAPTCHA Issues

1. Verify `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` matches your reCAPTCHA v3 site key
2. Verify domain is registered in Google reCAPTCHA admin console
3. Check browser console for reCAPTCHA JavaScript errors
4. Verify `RECAPTCHA_SECRET_KEY` is set correctly

## Performance Monitoring

```bash
# Monitor app metrics
flyctl status --app glass-loans-brochure-modified-misty-thunder-1484

# Check database stats
fly mpg status --app glass-loans-db

# View real-time logs
flyctl logs --app glass-loans-brochure-modified-misty-thunder-1484
```

## Rollback

If deployment fails:

```bash
# List releases
flyctl releases --app glass-loans-brochure-modified-misty-thunder-1484

# Rollback to previous version
flyctl releases rollback <version> --app glass-loans-brochure-modified-misty-thunder-1484
```

## Success Criteria

- ✅ Database tables created (users, underwriting_submissions, rate_limits)
- ✅ Email verification working (can receive and verify emails)
- ✅ 3-use limit enforced per email
- ✅ Email normalization prevents +1 tricks
- ✅ AI generates ARV, as-is value, rent estimates (if API key configured)
- ✅ Gary's opinion displays AI narrative
- ✅ Final score calculated (0-100) and displayed
- ✅ reCAPTCHA v3 protects form submission
- ✅ Rate limiting prevents abuse (10 requests/hour per IP)
- ✅ Number formatting shows commas in all inputs
- ✅ Mobile responsive on all screen sizes
- ✅ All calculations match Excel formulas exactly

## Next Steps After Deployment

1. **Custom Domain**: Point your domain to Fly.io
   ```bash
   flyctl certs create yourdomain.com --app glass-loans-brochure-modified-misty-thunder-1484
   ```

2. **Monitoring**: Set up alerts for errors and performance issues

3. **Analytics**: Add Google Analytics or similar

4. **Backup**: Set up automated database backups
   ```bash
   fly mpg backup create --app glass-loans-db
   ```

5. **Scaling**: Monitor usage and scale if needed
   ```bash
   flyctl scale count 2 --app glass-loans-brochure-modified-misty-thunder-1484
   ```
