const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const files = [];
for (const dir of ['js', 'scripts', 'api', 'lib']) {
  const walk = p => {
    if (!fs.existsSync(p)) return;
    for (const name of fs.readdirSync(p)) {
      const full = path.join(p, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.js') && !name.endsWith('.test.js')) files.push(full);
    }
  };
  walk(path.join(root, dir));
}
let failed = false;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`${path.relative(root, file)}: syntax error\n${r.stderr}`);
    failed = true;
  }
}
const browserDirs = ['js'];
for (const dir of browserDirs) {
  for (const name of fs.readdirSync(path.join(root, dir)).filter(n => n.endsWith('.js') && !n.endsWith('.test.js'))) {
    const src = fs.readFileSync(path.join(root, dir, name), 'utf8');
    if (/\b(require|module\.exports|process\.env)\b/.test(src)) {
      console.error(`${dir}/${name}: Node-only API found in browser JS`);
      failed = true;
    }
  }
}
console.log(`JavaScript validation: ${failed ? 'FAILED' : 'PASSED'} (${files.length} files)`);
if (failed) process.exit(1);
