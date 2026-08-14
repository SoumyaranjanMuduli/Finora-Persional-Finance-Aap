# Deployment & Setup Guide

Complete guide for deploying Finora to production.

## Phase 1: Supabase Setup

### 1. Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: Your app name (e.g., "finora-prod")
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
4. Click "Create new project" and wait for initialization (2-3 minutes)

### 2. Initialize Database Schema

Once your project is ready:

1. Open **SQL Editor** in your Supabase dashboard
2. Copy the entire contents of `supabase/schema.sql` and run it
   - Confirms: "13 tables created" (profiles, expenses, salary_settings, etc.)
3. Copy the entire contents of `supabase/policies.sql` and run it
   - Confirms: "56 policies created" (4 per table + storage policies)
   - **All tables now have RLS enabled**
4. Copy the entire contents of `supabase/functions.sql` and run it
   - Confirms: "3 functions created" + triggers for salary generation

**Do not skip this order.** Each step depends on the previous one.

### 3. Configure Authentication

In your Supabase project dashboard:

1. Go to **Authentication** → **Settings**
2. Under "Auth Providers":
   - ✅ Enable **Email**
   - ✅ Set "Confirm email" to **ON** (app expects verified emails)
   - Optional: Enable Google and/or Apple OAuth if desired
3. Under "URL Configuration":
   - **Site URL**: Set to your production domain (e.g., `https://finora.example.com`)
   - **Redirect URLs**: Add `https://finora.example.com/forgot-password.html?reset=1`
4. Under "Rate Limits" (important for security):
   - Set sign-in attempts: **5 per hour** (or your preference)
   - Set sign-up attempts: **3 per hour**
   - Set password recovery: **3 per hour**
   - These are server-side; app also has client-side backoff

### 4. Configure Storage

1. Go to **Storage** → **Buckets**
2. Confirm a bucket named `receipts` exists and is **private** (not public)
3. If not present, create it:
   - Name: `receipts`
   - Public: OFF (unchecked)

## Phase 2: Local Configuration

### 1. Set Environment Variables

Create a `.env.local` file in your project root:

```bash
# .env.local (do NOT commit this)

# Supabase (same as browser config)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...

# Server-only (for Vercel functions)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SECRET_KEY=eyJhbGc...

# Cron scheduler secret (generate a random 32-char string)
CRON_SECRET=your-random-secret-here-32-chars-minimum
```

### 2. Update Browser Config

Edit `js/config.runtime.js`:

```javascript
window.mfpSupabase = supabase.createClient(
  'https://xxxxxxxxxxxx.supabase.co',  // NEXT_PUBLIC_SUPABASE_URL
  'eyJhbGc...'                          // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
```

### 3. Test Locally

```bash
npm run check:all     # Validate everything
npm run dev           # Start local server
```

Navigate to http://localhost:3000 and test:
- Signup with test email
- Login/logout
- Add an expense
- Check rate limiting (submit login 5+ times to see backoff)

## Phase 3: Vercel Deployment

### 1. Connect Repository

1. Go to https://vercel.com and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Select the project and click "Import"

### 2. Configure Environment Variables

In Vercel project settings → **Environment Variables**:

Add these variables:

| Name | Value | Scope |
|------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxxx.supabase.co | Production |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | eyJhbGc... | Production |
| `SUPABASE_URL` | https://xxxx.supabase.co | Production |
| `SUPABASE_SECRET_KEY` | eyJhbGc... | Production |
| `CRON_SECRET` | (random 32+ char string) | Production |

**Important**: The first two are browser-safe (PUBLIC prefix). The last three are server-only.

### 3. Deploy

Click **Deploy** and wait for the build to complete.

### 4. Configure Post-Deployment

Once deployed to `https://your-domain.vercel.app`:

1. Return to Supabase → Authentication → URL Configuration
2. Update **Site URL** to your Vercel domain
3. Update **Redirect URLs** to include:
   - `https://your-domain.vercel.app/forgot-password.html?reset=1`

## Phase 4: Production Validation

### 1. Smoke Test the App

1. Visit your deployed app
2. **Signup**: Create a test account with test email
3. **Verify email**: Check inbox for verification link
4. **Login**: Login with test credentials
5. **Add data**: Create some expenses and income
6. **Verify RLS**: Create a second test account and confirm it cannot see User 1's data
7. **Test rate limiting**: Try logging in incorrectly 5+ times and confirm backoff message appears
8. **Test cron**: Wait a few minutes; salary generation runs via cron job

### 2. Verify Cron Endpoints

Test that unauthenticated requests are blocked:

```bash
# This should return 401 Unauthorized
curl https://your-domain.vercel.app/api/cron/daily-check

# This should return 401 Unauthorized
curl https://your-domain.vercel.app/api/cron/salary-check
```

### 3. Multi-User Isolation Test

1. Create **User A** and add some expenses
2. Create **User B** in an incognito window
3. Verify User B cannot see User A's data
4. Verify User A cannot see User B's data
5. Add salary to User A; verify User B is unaffected

### 4. Account Deletion Test

1. Create a test account
2. Add some data (expenses, income, etc.)
3. Call the account deletion endpoint:
   ```bash
   # This requires the user to be authenticated
   # Best tested via the app UI (if you add a delete account button)
   curl -X POST https://your-domain.vercel.app/api/account/delete \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```
4. Verify all user data is deleted from database

## Post-Launch Checklist

- [ ] Database initialized (schema, policies, functions)
- [ ] Supabase Auth configured with rate limits
- [ ] Storage bucket `receipts` exists and is private
- [ ] Environment variables set in Vercel
- [ ] Vercel domain added to Supabase Auth URL configuration
- [ ] Deployed to production
- [ ] Smoke tests passed (signup, login, data isolation, cron)
- [ ] Rate limiting verified (5 failed logins → backoff)
- [ ] Cron endpoints return 401 without token
- [ ] Account deletion working
- [ ] Backups configured in Supabase
- [ ] Error logging/monitoring configured (optional: Sentry, DataDog, etc.)

## Troubleshooting

### "Supabase is not configured"
- Ensure `js/config.runtime.js` has correct URL and publishable key
- Ensure both values are set in Vercel environment variables with `NEXT_PUBLIC_` prefix

### "Email not confirmed"
- User must verify their email after signup
- Ensure Supabase Auth has "Confirm email" enabled
- Check spam folder for verification email

### "Too many requests" / Rate limiting
- Supabase server-side rate limiting has been hit
- Client app also implements exponential backoff
- Wait 5 minutes and try again

### Cron jobs not running
- Ensure `CRON_SECRET` environment variable is set in Vercel
- Check Vercel function logs for errors
- Verify Supabase URL and SECRET_KEY are correct

### RLS policy errors
- Ensure all three SQL files were run in order
- Confirm authentication token is being sent to Supabase
- Check Supabase logs for policy rejection details

## Monitoring

### Logs to Watch

1. **Supabase Logs** (Dashboard → Logs):
   - RLS policy rejections (security audit)
   - Failed auth attempts
   - Function execution errors

2. **Vercel Logs** (Dashboard → Functions):
   - Cron job execution
   - API endpoint errors
   - Account deletion requests

3. **Browser Console**:
   - Network errors
   - Missing rates limiting
   - XSS/CSP violations

### Backup Strategy

1. Enable **Supabase automated backups** (Dashboard → Settings → Backups)
2. Set retention to 7+ days
3. Test restore process monthly

## Maintenance

### Monthly Tasks
- [ ] Review Supabase logs for anomalies
- [ ] Verify cron jobs are running
- [ ] Test account deletion flow
- [ ] Confirm backups are occurring

### Quarterly Tasks
- [ ] Update dependencies (if any)
- [ ] Run full security audit (`npm run check:security`)
- [ ] Test disaster recovery (restore from backup)
- [ ] Review and update rate limiting policies

## Support & Issues

See README.md for technical documentation and architecture details.
