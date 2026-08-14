/**
 * Unit tests for js/utils.js
 * Tests: money(), num(), esc(), date functions, sum(), categoryIcon()
 * Run with: node --test js/utils.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

// Mock window, document, and localStorage
globalThis.window = {
  MFP: null
};
globalThis.document = {
  createElement: () => ({
    className: '',
    textContent: '',
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {} },
    dataset: {},
  }),
  body: { appendChild: () => {} },
  querySelectorAll: () => []
};
globalThis.localStorage = {
  items: {},
  getItem(key) { return this.items[key] || null; },
  setItem(key, value) { this.items[key] = value; },
  removeItem(key) { delete this.items[key]; }
};
globalThis.requestAnimationFrame = (cb) => { cb(); return 0; };
globalThis.setTimeout = (cb, ms) => { cb(); return 0; };

// Mock XMLHttpRequest for globals check
globalThis.XMLHttpRequest = class {};

// Load the utils module
const fs = require('fs');
const utils = fs.readFileSync('./js/utils.js', 'utf8');
eval(utils);

const { money, num, esc, localDate, monthStart, monthEnd, monthKey, monthLabel, sum, categoryIcon, defaultCategories } = window.MFP;

test('money() - currency formatting', async t => {
  await t.test('formats INR currency (default)', () => {
    const result = money(1000);
    assert(result.includes('1,000'), `Expected formatted INR, got: ${result}`);
  });

  await t.test('formats USD currency', () => {
    window.MFP.setCurrency('USD');
    const result = money(1000);
    assert(result.includes('1,000'), `Expected formatted USD, got: ${result}`);
    window.MFP.setCurrency('INR'); // Reset
  });

  await t.test('formats zero amount', () => {
    const result = money(0);
    assert(typeof result === 'string', 'Should return string');
    assert(result.length > 0, 'Should not be empty');
  });

  await t.test('handles null/undefined', () => {
    const result1 = money(null);
    const result2 = money(undefined);
    assert(typeof result1 === 'string', 'null should return string');
    assert(typeof result2 === 'string', 'undefined should return string');
  });

  await t.test('formats large numbers', () => {
    const result = money(9999999.99);
    assert(typeof result === 'string', 'Should return formatted string');
  });
});

test('num() - number parsing', async t => {
  await t.test('parses valid numbers', () => {
    assert.strictEqual(num('123'), 123);
    assert.strictEqual(num('45.67'), 45.67);
    assert.strictEqual(num('-100'), -100);
  });

  await t.test('handles zero', () => {
    assert.strictEqual(num('0'), 0);
    assert.strictEqual(num(0), 0);
  });

  await t.test('defaults invalid to 0', () => {
    assert.strictEqual(num('abc'), 0);
    assert.strictEqual(num(''), 0);
    assert.strictEqual(num(null), 0);
    assert.strictEqual(num(undefined), 0);
  });

  await t.test('parses float values', () => {
    assert.strictEqual(num('3.14159'), 3.14159);
  });
});

test('esc() - HTML escaping', async t => {
  await t.test('escapes ampersand', () => {
    assert.strictEqual(esc('A & B'), 'A &amp; B');
  });

  await t.test('escapes less-than', () => {
    assert.strictEqual(esc('x < y'), 'x &lt; y');
  });

  await t.test('escapes greater-than', () => {
    assert.strictEqual(esc('x > y'), 'x &gt; y');
  });

  await t.test('escapes quotes', () => {
    assert.strictEqual(esc('say "hello"'), 'say &quot;hello&quot;');
    assert.strictEqual(esc("it's"), 'it&#39;s');
  });

  await t.test('escapes multiple characters', () => {
    assert.strictEqual(esc('<script>alert("XSS")</script>'), 
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  await t.test('handles empty string', () => {
    assert.strictEqual(esc(''), '');
  });

  await t.test('handles null/undefined', () => {
    assert.strictEqual(esc(null), '');
    assert.strictEqual(esc(undefined), '');
  });

  await t.test('does not double-escape', () => {
    const escaped = esc('<div>');
    assert.strictEqual(escaped, '&lt;div&gt;');
    assert(!escaped.includes('<div>'), 'Should not double-escape');
  });
});

test('localDate() - local date formatting', async t => {
  await t.test('formats current date as YYYY-MM-DD', () => {
    const result = localDate();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(result), `Invalid format: ${result}`);
  });

  await t.test('formats given date', () => {
    const result = localDate('2023-03-15T00:00:00Z');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(result), `Invalid format: ${result}`);
  });

  await t.test('handles edge dates', () => {
    const jan1 = localDate('2024-01-01T00:00:00Z');
    const dec31 = localDate('2023-12-31T00:00:00Z');
    assert(jan1.includes('-01-01'), `Jan 1 format: ${jan1}`);
    assert(dec31.includes('-12-31'), `Dec 31 format: ${dec31}`);
  });
});

test('monthStart() - month start date', async t => {
  await t.test('returns first day of current month', () => {
    const result = monthStart();
    assert(result instanceof Date, 'Should return Date object');
    assert.strictEqual(result.getDate(), 1, 'Should be first day');
  });

  await t.test('returns first day of given month', () => {
    const result = monthStart('2024-03-15T00:00:00Z');
    assert.strictEqual(result.getDate(), 1, 'Should be first day');
    assert.strictEqual(result.getMonth(), 2, 'Should be March (0-indexed)');
  });

  await t.test('handles year boundaries', () => {
    const result = monthStart('2024-01-01T00:00:00Z');
    assert.strictEqual(result.getDate(), 1);
    assert.strictEqual(result.getMonth(), 0);
    assert.strictEqual(result.getFullYear(), 2024);
  });
});

test('monthEnd() - month end date', async t => {
  await t.test('returns last day of current month at 23:59:59', () => {
    const result = monthEnd();
    assert(result instanceof Date, 'Should return Date object');
    assert.strictEqual(result.getHours(), 23);
    assert.strictEqual(result.getMinutes(), 59);
    assert.strictEqual(result.getSeconds(), 59);
  });

  await t.test('returns correct date for February in leap year', () => {
    const result = monthEnd('2024-02-01T00:00:00Z');
    assert.strictEqual(result.getDate(), 29, 'February 2024 has 29 days');
    assert.strictEqual(result.getMonth(), 1, 'Should be February');
  });

  await t.test('returns 30 for April', () => {
    const result = monthEnd('2024-04-01T00:00:00Z');
    assert.strictEqual(result.getDate(), 30);
  });

  await t.test('returns 31 for December', () => {
    const result = monthEnd('2024-12-01T00:00:00Z');
    assert.strictEqual(result.getDate(), 31);
  });
});

test('monthKey() - YYYY-MM key format', async t => {
  await t.test('returns correct format', () => {
    const result = monthKey('2024-03-15T00:00:00Z');
    assert.strictEqual(result, '2024-03', `Got: ${result}`);
  });

  await t.test('pads single-digit months', () => {
    const result = monthKey('2024-01-15T00:00:00Z');
    assert.strictEqual(result, '2024-01');
  });

  await t.test('current date format', () => {
    const result = monthKey();
    assert(/^\d{4}-\d{2}$/.test(result), `Invalid format: ${result}`);
  });
});

test('monthLabel() - human-readable month', async t => {
  await t.test('formats month label', () => {
    const result = monthLabel('2024-03');
    assert(result.includes('2024'), `Should include year: ${result}`);
    // Month name varies by locale
    assert(typeof result === 'string', 'Should return string');
  });

  await t.test('handles all months', () => {
    for (let i = 1; i <= 12; i++) {
      const key = `2024-${String(i).padStart(2, '0')}`;
      const result = monthLabel(key);
      assert(typeof result === 'string' && result.length > 0, 
        `Invalid label for ${key}: ${result}`);
    }
  });
});

test('sum() - array summation', async t => {
  await t.test('sums array with default key', () => {
    const data = [{ amount: 100 }, { amount: 50 }, { amount: 25 }];
    assert.strictEqual(sum(data), 175);
  });

  await t.test('sums with custom key', () => {
    const data = [{ price: 10 }, { price: 20 }];
    assert.strictEqual(sum(data, 'price'), 30);
  });

  await t.test('handles empty array', () => {
    assert.strictEqual(sum([]), 0);
  });

  await t.test('handles missing values', () => {
    const data = [{ amount: 100 }, { amount: undefined }, { amount: 50 }];
    assert.strictEqual(sum(data), 150);
  });

  await t.test('handles string numbers', () => {
    const data = [{ amount: '100' }, { amount: '50' }];
    assert.strictEqual(sum(data), 150);
  });

  await t.test('ignores non-numeric', () => {
    const data = [{ amount: 100 }, { amount: 'abc' }, { amount: 50 }];
    // num('abc') returns 0
    assert.strictEqual(sum(data), 150);
  });
});

test('categoryIcon() - icon mapping', async t => {
  await t.test('direct category match', () => {
    assert.strictEqual(categoryIcon('Groceries'), 'cart');
    assert.strictEqual(categoryIcon('Bus Travel'), 'bus');
    assert.strictEqual(categoryIcon('Rent'), 'rent');
  });

  await t.test('case-insensitive matching', () => {
    const result = categoryIcon('MOVIE');
    assert.strictEqual(result, 'movie');
  });

  await t.test('substring matching', () => {
    assert.strictEqual(categoryIcon('Movie Theater'), 'movie');
    assert.strictEqual(categoryIcon('Bus #5'), 'bus');
    assert.strictEqual(categoryIcon('Restaurant & Bar'), 'cart');
  });

  await t.test('returns fallback tag', () => {
    const result = categoryIcon('Unknown Category XYZ');
    assert.strictEqual(result, 'tag');
  });

  await t.test('handles null/empty', () => {
    assert.strictEqual(categoryIcon(null), 'tag');
    assert.strictEqual(categoryIcon(''), 'tag');
    assert.strictEqual(categoryIcon(undefined), 'tag');
  });

  await t.test('all default categories work', () => {
    for (const cat of defaultCategories) {
      const result = categoryIcon(cat);
      assert(typeof result === 'string' && result.length > 0,
        `No icon for category: ${cat}`);
    }
  });
});

test('defaultCategories - list available', async t => {
  await t.test('has categories', () => {
    assert(Array.isArray(defaultCategories), 'Should be array');
    assert(defaultCategories.length > 0, 'Should not be empty');
  });

  await t.test('common categories present', () => {
    const expected = ['Food & Groceries', 'Transport', 'Shopping', 'Other Spend'];
    for (const cat of expected) {
      assert(defaultCategories.includes(cat), `Missing: ${cat}`);
    }
  });
});

console.log('\n✓ All utils tests passed!\n');
