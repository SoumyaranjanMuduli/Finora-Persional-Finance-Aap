const { request, requestIn, supabase, timingSafeEqual } = require('../../lib/supabase-server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.CRON_SECRET || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ error: 'Cron is not configured' });
  if (!timingSafeEqual(req.headers.authorization || '', `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const items = await request(supabase('recurring_expenses', '?select=id,user_id,category_name,subcategory,amount,day_of_month,payment_method,notes&active=eq.true'));
    const userIds = [...new Set((items || []).map(r => r.user_id).filter(Boolean))];
    const prefs = await requestIn('user_preferences', 'user_id', userIds, 'user_id,timezone');
    const prefByUserId = new Map((prefs || []).map(p => [p.user_id, p]));
    const now = new Date();
    const due = [];

    for (const r of items || []) {
      const tz = prefByUserId.get(r.user_id)?.timezone || 'Asia/Kolkata';
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).reduce((a, x) => (a[x.type] = x.value, a), {});
      const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const dueDay = Math.min(r.day_of_month, lastDay);
      if (day < dueDay) continue;
      due.push({ ...r, tz, monthStart: `${year}-${String(month).padStart(2, '0')}-01`, dueDate: `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}` });
    }
    if (!due.length) return res.status(200).json({ ok: true, generated: 0 });

    const existing = new Set();
    for (const group of groupBy(due, x => x.monthStart).values()) {
      const monthStart = group[0].monthStart;
      const lastDay = new Date(Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0)).getUTCDate();
      const monthEnd = `${monthStart.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
      const rows = await requestIn('expenses', 'recurring_expense_id', group.map(x => x.id), 'recurring_expense_id,expense_date', `expense_date=gte.${monthStart}&expense_date=lte.${monthEnd}`);
      for (const row of rows || []) existing.add(`${row.recurring_expense_id}:${row.expense_date}`);
    }

    const notifications = [];
    let generated = 0;
    for (const r of due) {
      const key = `${r.id}:${r.dueDate}`;
      if (!existing.has(key)) {
        const inserted = await request(supabase('expenses'), {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify({ user_id: r.user_id, category_name: r.category_name, subcategory: r.subcategory, amount: r.amount, expense_date: r.dueDate, description: `${r.category_name} (auto)`, payment_method: r.payment_method, notes: r.notes, recurring_expense_id: r.id, source: 'recurring' })
        });
        if (inserted?.length) { existing.add(key); generated++; }
      }
      notifications.push({ user_id: r.user_id, notification_type: 'recurring_expense_added', title: 'Recurring expense added', message: `${r.category_name} for ${new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: r.tz }).format(new Date(`${r.monthStart}T12:00:00Z`))} has been added automatically.`, dedupe_key: `recurring:${r.id}:${r.monthStart}` });
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
