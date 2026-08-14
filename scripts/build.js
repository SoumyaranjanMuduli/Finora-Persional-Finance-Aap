const { spawnSync } = require('child_process');
const fs = require('fs');

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (url && key) {
  fs.writeFileSync('js/config.runtime.js', `window.MFP_CONFIG = { supabaseUrl: ${JSON.stringify(url)}, supabasePublishableKey: ${JSON.stringify(key)} };\n`);
  console.log('Generated browser Supabase config from build environment.');
} else {
  console.warn('Using placeholder js/config.runtime.js because Supabase browser env vars are missing.');
}

// Generate SRI from the exact pinned CDN bytes in the networked production build, then verify it offline.
run(process.execPath, ['scripts/generate-sri.js']);
run(process.execPath, ['scripts/sri-check.js']);

run(process.execPath, ['scripts/typecheck.js']);
run(process.execPath, ['scripts/ui-check.js']);
run(process.execPath, ['scripts/security-check.js']);
run(process.execPath, ['scripts/reference-check.js']);
console.log('Production static build validation complete.');
