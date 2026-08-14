const crypto = require('crypto');

// Constant-time comparison so an attacker can't infer the correct
// CRON_SECRET one character at a time from response-time differences.
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length so mismatched lengths take
    // roughly the same time as a real comparison, rather than returning early.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const headers = () => ({
  apikey: process.env.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
});

const supabase = (table, query = '') => `${process.env.SUPABASE_URL}/rest/v1/${table}${query}`;

async function request(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === 'object' && data?.message ? data.message : `Supabase request failed (${res.status})`);
  return data;
}

async function requestIn(table, column, values, select, extraQuery = '') {
  const ids = [...new Set((values || []).filter(Boolean).map(String))];
  if (!ids.length) return [];

  const rows = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).map(encodeURIComponent).join(',');
    const query = `?select=${select}&${encodeURIComponent(column)}=in.(${chunk})${extraQuery ? `&${extraQuery.replace(/^&/, '')}` : ''}`;
    rows.push(...(await request(supabase(table, query)) || []));
  }
  return rows;
}

module.exports = { request, requestIn, supabase, timingSafeEqual };
