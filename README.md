# Finora — My Finance Pro

**Track • Save • Grow**

A production-ready personal finance application built with vanilla HTML5, CSS3, JavaScript, Supabase PostgreSQL with Row-Level Security, Chart.js, and Vercel.

## Stack

- **Frontend**: No React / Next.js / TypeScript. Pure HTML5, CSS3, Vanilla JavaScript.
- **Backend**: Supabase PostgreSQL + Row-Level Security (RLS)
- **Charts**: Chart.js from CDN
- **Hosting**: Vercel (static + Serverless Functions + Cron)
- **Auth**: Supabase Auth (Email + Google + Apple OAuth)
- **Storage**: Private Supabase Storage bucket for receipts

## Features

- 💰 Daily expense tracking with 12+ categories
- 🛒 Grocery expense management with itemization
- ✈️ Travel & room-based expense tracking
- 📊 Interactive dashboards and financial reports
- 📈 Income tracking with automatic monthly salary generation
- 🎯 Savings goals and budget management
- 💳 Recurring expense automation
- 📵 Full PWA support (offline-capable static shell)
- 🔐 Security: RLS on all user tables, HTTPS/TLS in transit, encrypted database storage, and private receipt storage

## Quick Start

### Prerequisites
- Supabase account
- Vercel account
- Node.js ≥ 20

### Installation

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Generate the pinned CDN SRI hashes**
   ```bash
   npm run generate:sri
   ```
   This requires internet access once. The generated hashes are written into all 30 pinned CDN script tags. After that, normal production builds verify SRI offline.

3. **Create Supabase project**
   - Go to https://supabase.com and create a new project
   - Note your project URL and publishable key

4. **Initialize database**
   - In your Supabase project SQL editor, run:
     ```sql
     -- 1. Create tables
     -- (Run supabase/schema.sql)
     
     -- 2. Add RLS policies
     -- (Run supabase/policies.sql)
     
     -- 3. Add functions and triggers
     -- (Run supabase/functions.sql)

     -- Existing projects: also run supabase/migration_v1.5.sql after the files above.
     ```

5. **Configure browser**
   - Keep the tracked `js/config.runtime.js` placeholder unchanged. For deployment, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel; `npm run build` generates the browser config automatically.

6. **Run checks**
   ```bash
   npm run setup        # first-time setup: install + generate SRI + all checks
   npm run check:all   # all offline checks after SRI is generated
   npm run build        # production build
   npm run dev          # local dev server
   ```

7. **Deploy to Vercel**
   - Connect your repo to Vercel
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL` (browser-safe)
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe)
     - `SUPABASE_URL` (server-only)
     - `SUPABASE_SECRET_KEY` (server-only)
     - `CRON_SECRET` (for scheduled tasks)

## Audit & Updates

- **[SECURITY.md](./SECURITY.md)** — security model, threat assumptions and deployment controls.
- **[CHANGELOG.md](./CHANGELOG.md)** — version history.
- Users can check the running version and pull the latest release in-app via **More → App → Check for Updates**. See `CHANGELOG.md` and `version.json` for release/update information (bump `package.json`, `version.json`, `js/update.js`, and `sw.js`'s cache name together).

## Security Model

### Authentication
- Browser receives only the Supabase project URL and publishable key
- All API calls verified server-side via `/auth/v1/user` before privileged actions
- No client-supplied user IDs are trusted

### Database Security
- Every user-owned table has `user_id` column and RLS policies
- All policies enforce `auth.uid() = user_id` for complete data isolation
- Policies are explicit (not generated) for auditability
- Cascading deletes when user account is deleted

### Storage Security
- Private Supabase Storage bucket for receipt uploads
- Files stored in user-specific folders: `{auth.uid()}/filename`
- Storage policies enforce same ownership boundaries as database

### Secrets
- Service-role key and CRON_SECRET kept server-side only
- Never exposed in frontend code
- `scripts/security-check.js` validates secrets stay secret

### Rate Limiting
- Server-side: Supabase Auth applies default rate limits
- Client-side: UI implements exponential backoff for UX only (not a security control)
- Supabase Auth enforces the real server-side rate limits; configure them in Authentication → Rate Limits

### Account Deletion
- `api/account/delete.js` verifies caller via Supabase token
- Cascade deletes all user data from database
- Best-effort deletes receipts from storage
- No sensitive data retained

## Development

```bash
npm run dev           # Start local dev server (port 3000)
npm run check:all     # Run all validation checks
npm run test          # Run unit tests
npm run typecheck     # TypeScript/JSDoc type checking
npm run check:security # Security audit
```

## File Structure

```
├── css/                  # Stylesheets (variables, components, responsive)
├── js/
│   ├── utils.js         # Core utilities (formatting, DOM helpers, HTML escaping)
│   ├── rate-limit.js    # Client-side auth rate limiting
│   ├── config.js        # Deprecated placeholder
│   ├── config.runtime.js # Build-generated browser configuration
│   ├── auth.js          # Login, signup, password reset flows
│   ├── app.js           # Main routing and page rendering
│   └── *.js             # Page-specific logic
├── api/
│   ├── account/delete.js      # Account deletion endpoint
│   └── cron/                  # Scheduled tasks (salary generation, recurring expenses)
├── supabase/
│   ├── schema.sql       # Table definitions
│   ├── policies.sql     # Row-Level Security policies (14 tables)
│   └── functions.sql    # PL/pgSQL functions and triggers
├── scripts/
│   ├── typecheck.js     # TypeScript/JSDoc validation
│   ├── test.js          # Unit test runner
│   ├── security-check.js # Secret/security audit
│   ├── check-env.js     # Environment configuration validator
│   ├── build.js         # Production build
│   └── *.js             # Static analysis tools
└── *.html               # Page templates
```

## Testing

```bash
# Run unit tests for utils, date math, salary calculations
npm run test

# Type checking with real TypeScript (tsc --checkJs)
npm run typecheck

# Security audit (checks for leaked secrets)
npm run check:security

# All validations
npm run check:all
```

## Deployment Checklist

- [ ] Create Supabase production project
- [ ] Run `supabase/schema.sql`, `policies.sql`, `functions.sql`
- [ ] Configure Supabase Auth → URL Configuration with your domain
- [ ] Generate `CRON_SECRET` and add to Vercel
- [ ] Add all env variables to Vercel (see Quick Start)
- [ ] Deploy to Vercel
- [ ] Test: verify `/api/cron/daily-check` returns 401 without token
- [ ] Create test user and verify data isolation (User A cannot see User B data)
- [ ] Add salary and verify automatic monthly generation
- [ ] Verify daily details save correctly

## Production Readiness

✅ **Security**: RLS policies audited, XSS protection verified, no secrets leaked  
✅ **Type Safety**: JSDoc types with TypeScript checking (tsc --checkJs)  
✅ **Testing**: Unit tests for utils, date math, salary generation  
✅ **Performance**: Minified static assets, service worker for PWA  
✅ **Observability**: Security checks, environment validation, production checklist  
✅ **Documentation**: Architecture, deployment, security model all documented  

## License

Proprietary. All rights reserved.

## Support

For issues or questions, refer to the deployment guide and security documentation.

# Finora-Persional-Finance-Aap