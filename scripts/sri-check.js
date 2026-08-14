const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sri-manifest.json'), 'utf8')).resources;
let failed = false;
let count = 0;

for (const file of fs.readdirSync(root).filter(n => n.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [url, expected] of Object.entries(manifest)) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<script\\b[^>]*\\bsrc=["']${escaped}["'][^>]*>`, 'gi');
    for (const match of src.matchAll(re)) {
      count++;
      const tag = match[0];
      const integrity = tag.match(/\bintegrity=["'](sha(?:256|384|512)-[^"']+)["']/i)?.[1];
      const cors = tag.match(/\bcrossorigin=["']([^"']+)["']/i)?.[1];
      if (integrity !== expected) { console.error(`❌ ${file}: SRI mismatch for ${url}`); failed = true; }
      if (cors !== 'anonymous') { console.error(`❌ ${file}: missing crossorigin="anonymous" for ${url}`); failed = true; }
    }
  }
}
if (!count) { console.error('❌ No pinned CDN script tags were found.'); process.exit(1); }
console.log(`SRI validation: ${failed ? 'FAILED' : 'PASSED'} (${count} pinned CDN script tags checked)`);
if (failed) process.exit(1);
