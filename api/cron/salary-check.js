const { request, requestIn, supabase, timingSafeEqual } = require('../../lib/supabase-server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.CRON_SECRET || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ error: 'Cron is not configured' });
  if (!timingSafeEqual(req.headers.authorization || '', `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const settings = await request(supabase('salary_settings', '?select=user_id,monthly_salary,salary_day,active&active=eq.true'));
    const userIds = [...new Set((settings || []).map(s => s.user_id).filter(Boolean))];
    const prefs = await requestIn('user_preferences', 'user_id', userIds, 'user_id,timezone,salary_notifications_enabled');
    const prefByUserId = new Map((prefs || []).map(p => [p.user_id, p]));
    const now = new Date();
    const due = [];

    for (const s of settings || []) {
      const pref = prefByUserId.get(s.user_id);
      if (pref && !pref.salary_notifications_enabled) continue;
      const tz = pref?.timezone || 'Asia/Kolkata';
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).reduce((a, x) => (a[x.type] = x.value, a), {});
      const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const salaryDay = Math.min(s.salary_day, lastDay);
      if (day < salaryDay) continue;
      due.push({ ...s, tz, monthStart: `${year}-${String(month).padStart(2, '0')}-01`, salaryDate: `${year}-${String(month).padStart(2, '0')}-${String(salaryDay).padStart(2, '0')}` });
    }
    if (!due.length) return res.status(200).json({ ok: true, generated: 0 });

    const existing = new Set();
    for (const group of groupBy(due, x => x.monthStart).values()) {
      const rows = await requestIn('monthly_income', 'user_id', group.map(x => x.user_id), 'user_id,salary_month', `salary_month=eq.${group[0].monthStart}`);
      for (const row of rows || []) existing.add(`${row.user_id}:${row.salary_month}`);
    }

    const notifications = [];
    let generated = 0;
    for (const s of due) {
      const key = `${s.user_id}:${s.monthStart}`;
      if (!existing.has(key)) {
        await request(supabase('monthly_income'), {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: s.user_id, amount: s.monthly_salary, source: 'Salary', income_date: s.salaryDate, is_salary: true, salary_month: s.monthStart })
        });
        existing.add(key);
        generated++;
      }
      notifications.push({ user_id: s.user_id, notification_type: 'salary_added', title: 'Salary added', message: `Your ${new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: s.tz }).format(new Date(`${s.monthStart}T12:00:00Z`))} salary has been added.`, dedupe_key: `salary:${s.monthStart}` });
    }

    if (notifications.length) await request(supabase('notifications'), { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(notifications) });
    return res.status(200).json({ ok: true, generated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Cron execution failed' });
  }
};

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const group = groups.get(key);
    if (group) group.push(row); else groups.set(key, [row]);
  }
  return groups;
}
