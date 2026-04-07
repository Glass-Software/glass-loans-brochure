# Troubleshooting 401 Unauthorized Error

## Quick Diagnosis

Run these commands in order:

### 1. Verify CRON_SECRET is set in Fly
```bash
fly secrets list -a glass-loans-brochure-modified-misty-thunder-1484 | grep CRON_SECRET
```
✅ Should show: `CRON_SECRET ... Deployed`

### 2. Deploy the app with debug logging
```bash
./scripts/deploy.sh
```
⚠️ **Critical**: Fly secrets are only injected at runtime. If you set CRON_SECRET but haven't deployed/restarted since, the app won't see it!

### 3. Test the endpoint and check logs
```bash
# In terminal 1: Watch logs
fly logs -a glass-loans-brochure-modified-misty-thunder-1484

# In terminal 2: Test the endpoint
./scripts/test-cron.sh
# Choose option 1 (Production)
```

### 4. Check the debug output

In the logs, you should see:
```
🔍 [reset-usage] Auth check: {
  hasAuthHeader: true,
  authHeaderPrefix: 'Bearer b81...',
  hasExpectedToken: true,
  expectedTokenPrefix: 'b811f1708e...',
  match: true
}
```

## Common Issues

### Issue 1: `hasExpectedToken: false`
**Cause**: App can't see CRON_SECRET environment variable

**Solution**:
```bash
# Restart the app to load the secret
fly apps restart glass-loans-brochure-modified-misty-thunder-1484

# Wait 30 seconds, then test again
./scripts/test-cron.sh
```

### Issue 2: `match: false` but both tokens exist
**Cause**: The CRON_SECRET being sent doesn't match the one in Fly

**Solution**:
```bash
# Get the actual secret value from Fly (only shows prefix)
fly secrets list -a glass-loans-brochure-modified-misty-thunder-1484

# Regenerate and set a new one
NEW_SECRET=$(openssl rand -hex 32)
echo "New secret: $NEW_SECRET"

# Set it in Fly
fly secrets set CRON_SECRET="$NEW_SECRET" -a glass-loans-brochure-modified-misty-thunder-1484

# IMPORTANT: Restart the app
fly apps restart glass-loans-brochure-modified-misty-thunder-1484

# Test with the new secret
curl -X POST https://glassloans.io/api/cron/reset-usage \
  -H "Authorization: Bearer $NEW_SECRET"
```

### Issue 3: `hasAuthHeader: false`
**Cause**: The test script or cron manager isn't sending the Authorization header

**Solution**: Check your test command format:
```bash
# Correct format:
curl -X POST https://glassloans.io/api/cron/reset-usage \
  -H "Authorization: Bearer YOUR_SECRET_HERE"

# NOT:
curl -X POST https://glassloans.io/api/cron/reset-usage?token=YOUR_SECRET
```

## Manual Test Command

If the test script fails, try manually:

```bash
# Get your secret (you set this earlier)
CRON_SECRET="<your-secret-value>"

# Test production
curl -v -X POST https://glassloans.io/api/cron/reset-usage \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# Check for:
# - HTTP/2 200 (success)
# - HTTP/2 401 (unauthorized - secret mismatch)
# - HTTP/2 500 (server error - secret not configured)
```

## Next Steps After Fixing

Once you get a 200 response:

1. **Update cron.json** with the correct secret format
2. **Deploy cron-manager** (see CRON_QUICKSTART.md)
3. **Monitor** the first automated run

## Still Getting 401?

Check these:

1. **Secret format**: Must be `Authorization: Bearer <token>` (note the space after "Bearer")
2. **Secret value**: Must match exactly (case-sensitive, no extra spaces)
3. **Environment**: Make sure you're testing production, not localhost
4. **Deployment**: App must be restarted after setting secrets

Need more help? Check the logs with:
```bash
fly logs -a glass-loans-brochure-modified-misty-thunder-1484 --timestamps
```
