const assert = require('assert');

const baseUrl = (process.env.E2E_BASE_URL || '').replace(/\/$/, '');
const sbUrl = (process.env.E2E_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.E2E_SUPABASE_PUBLISHABLE_KEY || '';
const users = [
  { email: process.env.E2E_EMAIL_A, password: process.env.E2E_PASSWORD_A },
  { email: process.env.E2E_EMAIL_B, password: process.env.E2E_PASSWORD_B }
];

for (const [name, value] of Object.entries({ E2E_BASE_URL: baseUrl, E2E_SUPABASE_URL: sbUrl, E2E_SUPABASE_PUBLISHABLE_KEY: key })) {
  if (!value) throw new Error(`${name} is required`);
}
for (const [i, user] of users.entries()) {
  if (!user.email || !user.password) throw new Error(`E2E_EMAIL_${String.fromCharCode(65 + i)} and matching password are required`);
}

async function req(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { res, data };
}

async function signIn(user) {
  const { res, data } = await req(`${sbUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password })
  });
  assert.equal(res.status, 200, `Supabase login failed for ${user.email}: ${JSON.stringify(data)}`);
  assert.ok(data.access_token && data.user?.id, `Supabase login returned no session for ${user.email}`);
  return data;
}

function authHeaders(token) {
  return { apikey: key, Authorization: `Bearer ${token}` };
}

async function main() {
  const a = await signIn(users[0]);
  const b = await signIn(users[1]);

  const own = await req(`${sbUrl}/rest/v1/expenses?select=id,user_id&limit=100`, { headers: authHeaders(a.access_token) });
  assert.equal(own.res.status, 200, `User A expense read failed: ${JSON.stringify(own.data)}`);
  assert.ok((own.data || []).every(row => row.user_id === a.user.id), 'User A received another user\'s expense');

  const crossRead = await req(`${sbUrl}/rest/v1/expenses?select=id,user_id&user_id=eq.${encodeURIComponent(b.user.id)}&limit=10`, { headers: authHeaders(a.access_token) });
  assert.equal(crossRead.res.status, 200, `Cross-user read request failed: ${JSON.stringify(crossRead.data)}`);
  assert.equal((crossRead.data || []).length, 0, 'RLS leak: User A can read User B expenses');

  const profileCrossRead = await req(`${sbUrl}/rest/v1/profiles?select=id,user_id&user_id=eq.${encodeURIComponent(b.user.id)}`, { headers: authHeaders(a.access_token) });
  assert.equal(profileCrossRead.res.status, 200, `Cross-user profile read request failed: ${JSON.stringify(profileCrossRead.data)}`);
  assert.equal((profileCrossRead.data || []).length, 0, 'RLS leak: User A can read User B profile');

  const bOwn = await req(`${sbUrl}/rest/v1/expenses?select=id,user_id&limit=100`, { headers: authHeaders(b.access_token) });
  assert.equal(bOwn.res.status, 200, `User B expense read failed: ${JSON.stringify(bOwn.data)}`);
  assert.ok((bOwn.data || []).every(row => row.user_id === b.user.id), 'User B received another user\'s expense');

  const page = await req(`${baseUrl}/login.html`);
  assert.equal(page.res.status, 200, `Live login page failed with HTTP ${page.res.status}`);
  assert.equal(page.res.headers.get('x-content-type-options'), 'nosniff', 'Missing X-Content-Type-Options');
  assert.equal(page.res.headers.get('x-frame-options'), 'DENY', 'Missing X-Frame-Options');
  assert.ok((page.res.headers.get('content-security-policy') || '').includes("script-src-attr 'none'"), 'CSP is not enforcing script-src-attr none');

  console.log('Live E2E: PASSED');
  console.log('✓ User A can read only User A expenses');
  console.log('✓ User A cannot read User B expenses');
  console.log('✓ User A cannot read User B profile');
  console.log('✓ User B can read only User B expenses');
  console.log('✓ Vercel login page + security headers verified');
}

main().catch(err => {
  console.error(`Live E2E: FAILED — ${err.message}`);
  process.exit(1);
});
