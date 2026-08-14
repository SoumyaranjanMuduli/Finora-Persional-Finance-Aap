const fs = require('fs');
const cfg = fs.readFileSync('js/config.runtime.js', 'utf8');
const placeholderUrl = /https:\/\/your-project\.supabase\.co/;
const placeholderKey = /sb_publishable_your_key_here/;
const hasRealUrl = /https:\/\/[^'"\s]+\.supabase\.co/.test(cfg) && !placeholderUrl.test(cfg);
const hasRealKey = /sb_publishable_[A-Za-z0-9._-]+/.test(cfg) && !placeholderKey.test(cfg);
if (hasRealUrl || hasRealKey) {
  console.error('❌ js/config.runtime.js contains a real Supabase browser credential. Keep the tracked file placeholder-only.');
  process.exit(1);
}
if (!placeholderUrl.test(cfg) || !placeholderKey.test(cfg)) {
  console.error('❌ js/config.runtime.js must contain the documented placeholders.');
  process.exit(1);
}
console.log('✓ Browser config is placeholder-only; deployment config is generated from environment variables.');
