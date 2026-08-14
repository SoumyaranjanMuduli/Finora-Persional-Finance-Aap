const { request, requestIn, supabase, timingSafeEqual } = require('../../lib/supabase-server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.CRON_SECRET || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ error: 'Cron is not configured' });
  if (!timingSafeEqual(req.headers.authorization || '', `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const prefs = await request(supabase('user_preferences', '?select=user_id,timezone,daily_reminder_enabled&daily_reminder_enabled=eq.true'));
    const rows = (prefs || []).map(p => ({
      ...p,
      date: new Intl.DateTimeFormat('en-CA', { timeZone: p.timezone || 'Asia/Kolkata' }).format(new Date())
    }));
    if (!rows.length) return res.status(200).json({ ok: true, created: 0 });

    const minDate = rows.reduce((min, x) => x.date < min ? x.date : min, rows[0].date);
    const maxDate = rows.reduce((max, x) => x.date > max ? x.date : max, rows[0].date);
    const userIds = rows.map(x => x.user_id);
    const statuses = await requestIn('daily_status', 'user_id', userIds, 'user_id,status_date,completed', `status_date=gte.${minDate}&status_date=lte.${maxDate}`);
    const statusByKey = new Map((statuses || []).map(x => [`${x.user_id}:${x.status_date}`, x.completed]));
    const notifications = rows.filter(p => !statusByKey.get(`${p.user_id}:${p.date}`)).map(p => ({
      user_id: p.user_id,
      notification_type: 'daily_expense_reminder',
      title: "Today's expense reminder",
      message: "Today's expense details haven't been added.",
      dedupe_key: `daily-expense:${p.date}`
    }));

    if (notifications.length) {
      await request(supabase('notifications'), {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(notifications)
      });
    }
    return res.status(200).json({ ok: true, created: notifications.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Cron execution failed' });
  }
};
