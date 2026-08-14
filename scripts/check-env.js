const fs = require('fs');
const required = ['index.html','login.html','signup.html','forgot-password.html','dashboard.html','income.html','expenses.html','reports.html','more.html','budgets.html','savings-goals.html','profile.html','transactions.html','export.html','supabase/schema.sql','supabase/policies.sql','supabase/functions.sql','supabase/migration_v1.5.sql','api/cron/daily-check.js','api/cron/salary-check.js'];
const missing = required.filter(f => !fs.existsSync(f));
if (missing.length) { console.error('Missing required files:\n' + missing.join('\n')); process.exit(1); }
console.log('Project structure: OK');
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)) console.warn('Build-time Supabase browser variables are not set. js/config.runtime.js will keep placeholders until Vercel build variables are configured.');
if (!process.env.SUPABASE_SECRET_KEY) console.warn('SUPABASE_SECRET_KEY is not set locally. Required only by privileged Vercel functions.');
if (!process.env.CRON_SECRET) console.warn('CRON_SECRET is not set locally. Required by Vercel Cron endpoints.');
