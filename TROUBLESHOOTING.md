# Troubleshooting Guide: GitHub Actions Workflow Errors

## Common Errors and Solutions

### Error 1: "CRON_SECRET environment variable is required"

**Symptoms:**
- Script exits immediately
- Error message: "❌ Error: CRON_SECRET environment variable is required"

**Solution:**
1. Go to GitHub → Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `CRON_SECRET`
4. Value: Your secret (the hex string you generated)
5. Click "Add secret"
6. Re-run the workflow

**Also check:**
- Make sure you added it as a **Repository secret** (not Environment secret)
- The name must be exactly `CRON_SECRET` (case-sensitive)

---

### Error 2: "KOLOS_API_URL environment variable is required"

**Symptoms:**
- Script exits immediately
- Error message: "❌ Error: KOLOS_API_URL environment variable is required"

**Solution:**
1. Go to GitHub → Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `KOLOS_API_URL`
4. Value: Your deployed app URL (e.g., `https://your-app.vercel.app`)
5. Click "Add secret"
6. Re-run the workflow

**Important:**
- Use your **production URL** (HTTPS)
- Include `https://` prefix
- No trailing slash
- Example: `https://kolos-app.vercel.app`

---

### Error 3: "ECONNREFUSED" or "ENOTFOUND"

**Symptoms:**
- Error: "Request failed"
- Error code: `ECONNREFUSED` or `ENOTFOUND`

**Possible Causes:**
1. **Wrong API URL**
   - Check `KOLOS_API_URL` in GitHub Secrets
   - Verify the URL is correct and accessible
   - Test by visiting the URL in a browser

2. **App not deployed**
   - Make sure your Next.js app is deployed
   - Check your deployment platform (Vercel/Railway/etc.)

3. **API endpoint doesn't exist**
   - Verify `/api/signals/update-all` route exists
   - Check that you pushed the code to GitHub

**Solution:**
1. Test the API URL manually:
   ```bash
   curl https://your-app.vercel.app/api/signals/update-all
   ```
   Should return 401 (Unauthorized) - this means the endpoint exists

2. Verify deployment:
   - Check Vercel/Railway dashboard
   - Ensure latest code is deployed

3. Check GitHub Secrets:
   - Verify `KOLOS_API_URL` is correct
   - Re-run workflow after fixing

---

### Error 4: "401 Unauthorized"

**Symptoms:**
- Status Code: 401
- Error: "Unauthorized: Invalid secret" or "Unauthorized: Missing or invalid Authorization header"

**Possible Causes:**
1. **CRON_SECRET mismatch**
   - GitHub Secrets value ≠ Deployment platform value
   - They must be **identical**

2. **Secret not set in deployment platform**
   - `CRON_SECRET` missing in Vercel/Railway/etc.

**Solution:**
1. **Check GitHub Secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Verify `CRON_SECRET` exists
   - Note the value (last 4 characters shown)

2. **Check Deployment Platform:**
   - Go to your deployment platform (Vercel/Railway/etc.)
   - Settings → Environment Variables
   - Verify `CRON_SECRET` exists
   - Value must match GitHub Secrets exactly

3. **Fix:**
   - If missing: Add `CRON_SECRET` to deployment platform
   - If different: Update to match GitHub Secrets
   - **Redeploy** your app after adding/updating

4. **Test:**
   - Re-run the workflow

---

### Error 5: "500 Internal Server Error"

**Symptoms:**
- Status Code: 500
- Error from API endpoint

**Possible Causes:**
1. **Missing environment variables in deployment platform:**
   - `GOOGLE_SHEET_ID`
   - `OPENAI_API_KEY`
   - `GOOGLE_CREDENTIALS`

2. **Invalid Google Sheets configuration**
   - Wrong `GOOGLE_SHEET_ID`
   - Invalid `GOOGLE_CREDENTIALS`

3. **OpenAI API issues**
   - Invalid `OPENAI_API_KEY`
   - API quota exceeded
   - Rate limiting

**Solution:**
1. **Check Deployment Platform Logs:**
   - Go to Vercel/Railway/etc. dashboard
   - View deployment logs
   - Look for specific error messages

2. **Verify Environment Variables:**
   - Check all required variables are set:
     - `GOOGLE_SHEET_ID`
     - `OPENAI_API_KEY`
     - `GOOGLE_CREDENTIALS` (or `GOOGLE_CREDENTIALS_PATH`)
     - `CRON_SECRET`

3. **Test OpenAI API:**
   - Check OpenAI dashboard for quota/usage
   - Verify API key is valid

4. **Test Google Sheets:**
   - Verify `GOOGLE_SHEET_ID` is correct
   - Check Google service account has access

---

### Error 6: "Request timed out"

**Symptoms:**
- Error: "Request timed out"
- Script timeout after 10 minutes

**Possible Causes:**
- Too many profiles to process
- OpenAI API is slow
- Network issues

**Solution:**
1. **Process fewer profiles:**
   - Use `profile_ids` input to test with 1-2 profiles first
   - Gradually increase

2. **Check OpenAI API:**
   - Verify API is responding
   - Check for rate limiting

3. **Increase timeout (if needed):**
   - Edit `scripts/update-all-signals.js`
   - Change `timeout: 600000` to a higher value (in milliseconds)

---

### Error 7: "404 Not Found"

**Symptoms:**
- Status Code: 404
- API endpoint not found

**Possible Causes:**
1. **Route doesn't exist**
   - `/api/signals/update-all` not deployed
   - Code not pushed to GitHub

2. **Wrong API URL**
   - `KOLOS_API_URL` points to wrong domain

**Solution:**
1. **Verify route exists:**
   - Check `src/app/api/signals/update-all/route.js` exists
   - Push code to GitHub if missing

2. **Verify deployment:**
   - Check deployment platform
   - Ensure latest code is deployed

3. **Test endpoint:**
   ```bash
   curl https://your-app.vercel.app/api/signals/update-all
   ```
   Should return 401 (not 404)

---

## Debugging Steps

### Step 1: Check GitHub Secrets
1. Go to Repository → Settings → Secrets and variables → Actions
2. Verify both secrets exist:
   - `CRON_SECRET` ✅
   - `KOLOS_API_URL` ✅

### Step 2: Check Deployment Platform
1. Go to your deployment platform (Vercel/Railway/etc.)
2. Settings → Environment Variables
3. Verify all required variables:
   - `CRON_SECRET` ✅
   - `GOOGLE_SHEET_ID` ✅
   - `OPENAI_API_KEY` ✅
   - `GOOGLE_CREDENTIALS` ✅

### Step 3: Test API Endpoint Manually
```bash
# Test if endpoint exists (should return 401)
curl https://your-app.vercel.app/api/signals/update-all

# Test with authentication (replace YOUR_SECRET)
curl -X POST https://your-app.vercel.app/api/signals/update-all \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Step 4: Check Workflow Logs
1. Go to GitHub → Actions tab
2. Click on the failed workflow run
3. Click on "update-signals" job
4. Click on "Update all member signals" step
5. Read the error message carefully

### Step 5: Check Deployment Logs
1. Go to your deployment platform
2. View logs for the latest deployment
3. Look for errors related to:
   - Missing environment variables
   - API errors
   - Google Sheets errors

---

## Quick Checklist

Before running the workflow, verify:

- [ ] `CRON_SECRET` in GitHub Secrets
- [ ] `KOLOS_API_URL` in GitHub Secrets (correct URL)
- [ ] `CRON_SECRET` in deployment platform (matches GitHub)
- [ ] `GOOGLE_SHEET_ID` in deployment platform
- [ ] `OPENAI_API_KEY` in deployment platform
- [ ] `GOOGLE_CREDENTIALS` in deployment platform
- [ ] App is deployed and accessible
- [ ] `/api/signals/update-all` route exists
- [ ] Code is pushed to GitHub

---

## Getting Help

If you're still stuck:

1. **Check the workflow logs:**
   - Go to Actions → Failed run → View logs
   - Copy the error message

2. **Check deployment logs:**
   - View logs in Vercel/Railway/etc.
   - Look for server-side errors

3. **Test locally:**
   ```bash
   export KOLOS_API_URL="http://localhost:3000"
   export CRON_SECRET="your_secret"
   node scripts/update-all-signals.js
   ```

4. **Verify secrets match:**
   - GitHub Secrets `CRON_SECRET` = Deployment platform `CRON_SECRET`
   - They must be identical

---

## Common Mistakes

1. **Secret name typo:**
   - ❌ `CRON_SECRET_KEY` (wrong)
   - ✅ `CRON_SECRET` (correct)

2. **Missing https:// in URL:**
   - ❌ `your-app.vercel.app` (wrong)
   - ✅ `https://your-app.vercel.app` (correct)

3. **Secret mismatch:**
   - GitHub: `secret123`
   - Vercel: `secret456` ❌
   - Must be identical ✅

4. **Forgot to redeploy:**
   - Added secret to Vercel but didn't redeploy
   - Always redeploy after adding environment variables

---

**Last Updated:** December 2024

