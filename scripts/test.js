const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

console.log('\n🧪 Running unit tests...\n');

// Find all .test.js files
const testFiles = [];
for (const dir of ['js', 'scripts', 'api', 'lib']) {
  const walk = p => {
    if (!fs.existsSync(p)) return;
    for (const name of fs.readdirSync(p)) {
      const full = path.join(p, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.test.js')) testFiles.push(full);
    }
  };
  walk(path.join(root, dir));
}

if (testFiles.length === 0) {
  console.log('⚠️  No test files found (*.test.js)\n');
  process.exit(0);
}

console.log(`Found ${testFiles.length} test file(s):\n`);

let totalFailed = false;
for (const file of testFiles) {
  console.log(`▶️  ${path.relative(root, file)}`);
  const result = spawnSync(process.execPath, ['--test', file], {
    cwd: root,
    stdio: 'inherit',
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    totalFailed = true;
  }
}

if (totalFailed) {
  console.error('\n❌ Some tests failed');
  process.exit(1);
}

console.log('\n✓ All unit tests passed!\n');
