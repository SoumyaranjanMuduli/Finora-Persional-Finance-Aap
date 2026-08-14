# Making Updates & Adding Features

Once Finora is deployed on Vercel and connected to a Git repo, shipping a
change is just: **edit → test locally → commit → push.** Vercel does the
rest automatically.

## 1. One-time setup (only if you haven't already)

```bash
git init
git add .
git commit -m "Initial Finora deploy"
git remote add origin <your-repo-url>
git push -u origin main
```

Then in Vercel: **Add New Project → Import** that repo. From now on,
every `git push` to `main` triggers a new production deployment automatically.

## 2. Making a change

1. Edit the relevant file(s) locally — HTML pages, `js/*.js`, `css/*.css`,
   `api/*.js`, or `supabase/*.sql`.
2. Run the full validation suite before pushing anything:
   ```bash
   npm run check:all
   ```
   This runs structure checks, type checking, UI-reference validation, the
   static security audit, and the unit tests — catching most mistakes
   before they ever reach production.
3. If you touched `supabase/*.sql` (new table, new column, new policy),
   run that SQL in the Supabase **SQL Editor** yourself — Vercel never
   touches your database, only the app code.

## 3. Shipping it

```bash
git add .
git commit -m "Describe what changed"
git push
```

Vercel builds (`npm run build`, which re-injects your Supabase keys and
re-runs the checks) and deploys automatically — usually live within a
minute. You'll see the deployment (and a preview URL) in the Vercel
dashboard for every push, and production updates once it lands on `main`.

## 4. Adding a brand-new feature (typical shape)

Most features touch four places:
- **A page** — copy the structure of a similar existing `.html` file for
  consistent header/nav/CSP-safe markup (no inline `<script>` or `style=`,
  see `css/utilities.css` for spacing helpers).
- **Its logic** — a new `case` block inside the big page-router in
  `js/app.js` (search for `data-page` to see the pattern), or a new file
  under `js/` if it's substantial enough to stand alone.
- **Its data** — a new table/column in `supabase/schema.sql` plus matching
  rows in `supabase/policies.sql` (every table needs RLS policies —
  `scripts/security-check.js` will fail the build if you forget).
- **Its styling** — add to the relevant `css/*.css` file rather than
  writing inline styles, so the CSP (which no longer allows
  `unsafe-inline`) keeps working.

## 5. How users get the update on their phones

Because the app is a PWA with a service worker (`sw.js`), installed users
don't need to reinstall anything. The service worker checks for a new
version on every visit; when one lands, it swaps in the new code and the
open tab reloads itself once automatically (see `js/pwa.js`). If you
change what's precached for offline use, bump `CACHE_NAME` in `sw.js` (e.g.
`mfp-shell-v4` → `v5`) so old caches get cleared out.

## 6. Rolling back

Every deployment in the Vercel dashboard can be "promoted" back to
production with one click if a change causes a problem — no git revert
needed for a quick rollback, though committing the revert afterward keeps
your repo history honest.
