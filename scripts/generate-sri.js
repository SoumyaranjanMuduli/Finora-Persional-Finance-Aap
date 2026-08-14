const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sri-manifest.json'), 'utf8')).resources;
const files = fs.readdirSync(root).filter(n => n.endsWith('.html'));
let updated = 0;

for (const [url, integrity] of Object.entries(manifest)) {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<script\\b([^>]*\\bsrc=["']${escaped}["'][^>]*)>`, 'gi');
  for (const file of files) {
    const p = path.join(root, file);
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(re, (_, attrs) => {
      let clean = attrs.replace(/\s+integrity=["'][^"']*["']/gi, '').replace(/\s+crossorigin=["'][^"']*["']/gi, '');
      return `<script${clean} integrity="${integrity}" crossorigin="anonymous">`;
    });
    if (after !== before) { fs.writeFileSync(p, after); updated++; }
  }
}

console.log(`SRI manifest applied offline (${updated} HTML script tags).`);
