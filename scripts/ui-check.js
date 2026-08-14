const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const localExts = /^(css|js|supabase|api|assets|scripts|reference)\//;
let failed = false;
const pages = new Set(htmlFiles);

for (const file of htmlFiles) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/^<!doctype html>/i.test(src)) { console.error(`${file}: missing HTML5 doctype`); failed = true; }
  if (!/<meta[^>]+name=["']viewport/i.test(src)) { console.error(`${file}: missing viewport meta`); failed = true; }
  if (/react|next\/|\.tsx?\b/i.test(src)) { console.error(`${file}: React/Next/TypeScript reference found`); failed = true; }
  for (const ref of src.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const target = ref[1];
    if (/^(https?:|\/\/|#|mailto:|data:|javascript:)/i.test(target)) continue;
    const clean = target.split('?')[0].split('#')[0];
    if (!clean) continue;
    if (!fs.existsSync(path.resolve(root, clean))) { console.error(`${file}: missing local asset ${target}`); failed = true; }
    if (clean.endsWith('.html') && !pages.has(path.basename(clean))) { console.error(`${file}: missing page ${target}`); failed = true; }
  }
  const app = /data-page=["']([^"']+)["']/.exec(src)?.[1];
  if (app && !['login','signup','forgot-password','splash'].includes(app) && !/js\/app\.js/.test(src)) { console.error(`${file}: protected page does not load app.js`); failed = true; }
}

const jsDir = path.join(root, 'js');
for (const file of fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(jsDir, file), 'utf8');
  if (/service_role|SUPABASE_SECRET_KEY|CRON_SECRET/i.test(src)) { console.error(`${file}: server secret reference found in browser code`); failed = true; }
}

console.log(`UI reference validation: ${failed ? 'FAILED' : 'OK'}`);
if (failed) process.exit(1);
