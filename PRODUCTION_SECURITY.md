# Finora Production Security Runbook

Finora is designed for production deployment with Supabase RLS, private receipt storage, server-only service credentials, protected Vercel cron endpoints, strict security headers, and client-side SRI for pinned third-party scripts.

## Before first production deploy

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel.
2. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and a long random `CRON_SECRET` only as server-side Vercel environment variables. Never put these in `js/config.runtime.js`.
3. Apply `supabase/schema.sql`, `supabase/functions.sql`, and `supabase/policies.sql` to the production Supabase project.
4. Confirm Supabase Storage bucket `receipts` is private and run the Supabase Security Advisor.
5. Configure your real security contact and canonical URL in `.well-known/security.txt`.
6. Production builds run `generate:sri` automatically before validation. The build environment must have outbound HTTPS access to the exact pinned CDN URLs so the hash is calculated from the bytes that will be served. Never invent or copy a hash from another version.
7. Verify Vercel HTTPS, custom domain, Auth redirect URLs, and email templates.
8. Rotate any secret that has ever been pasted into a browser file, Git history, screenshot, or public repository.

## Security model

- Browser code contains only the Supabase publishable key.
- Service-role credentials are server-only.
- User-owned database rows require `auth.uid() = user_id`.
- Receipt objects are private and scoped to the authenticated user's folder.
- Security-definer SQL functions pin `search_path` to an empty path and are revoked from `public`.
- Cron routes require `CRON_SECRET`.
- Account deletion verifies the caller's Supabase access token before using the service role.
- CSV exports neutralize spreadsheet formulas.
- Vercel sends CSP, HSTS, frame, MIME-sniffing, referrer, permissions and cross-origin policy headers.

## What “100% hacker proof” means

No internet application can honestly guarantee zero vulnerabilities. Production security is a layered system: code, dependency updates, Supabase configuration, Auth settings, secrets management, hosting configuration, backups, monitoring, incident response, and ongoing patching all matter.
