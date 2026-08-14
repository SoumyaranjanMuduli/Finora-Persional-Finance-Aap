// Deletes the authenticated caller's own account and all owned data.
// Every user-owned table has `on delete cascade` back to auth.users(id), so
// deleting the auth user cascades through profiles, expenses, income,
// budgets, goals, notifications, etc. automatically. Uploaded receipts in
// storage are removed on a best-effort basis (storage does not cascade).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ error: 'Account deletion is not configured on the server.' });
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return res.status(401).json({ error: 'Missing session token.' });

  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  try {
    // Step 1: verify the caller's own access token and resolve their user id.
    // We never trust a client-supplied user id — only the id embedded in a
    // token that Supabase itself validates.
    const whoAmI = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: secretKey, Authorization: `Bearer ${accessToken}` }
    });
    if (!whoAmI.ok) return res.status(401).json({ error: 'Your session is invalid or expired.' });
    const user = await whoAmI.json();
    if (!user?.id) return res.status(401).json({ error: 'Your session is invalid or expired.' });

    // Step 2: remove every receipt before deleting the auth user. Storage listing is paginated.
    const removeReceipts = async () => {
      const limit = 100;
      let offset = 0;
      for (;;) {
        const listRes = await fetch(`${base}/storage/v1/object/list/receipts`, {
          method: 'POST',
          headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: `${user.id}/`, limit, offset, sortBy: { column: 'name', order: 'asc' } })
        });
        if (!listRes.ok) throw new Error(`Storage list failed (${listRes.status})`);
        const list = await listRes.json();
        const paths = (list || []).filter(f => f?.id !== null && f?.name).map(f => `${user.id}/${f.name}`);
        if (!paths.length) return;
        const delRes = await fetch(`${base}/storage/v1/object/receipts`, {
          method: 'DELETE',
          headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: paths })
        });
        if (!delRes.ok) throw new Error(`Storage delete failed (${delRes.status})`);
        if (paths.length < limit) return;
        offset += paths.length;
      }
    };
    try {
      await removeReceipts();
    } catch (storageErr) {
      console.error('Receipt cleanup failed; account deletion aborted:', storageErr);
      return res.status(503).json({ error: 'Could not finish receipt cleanup. Please try again.' });
    }

    // Step 3: delete the auth user. All owned rows cascade via foreign keys.
    const del = await fetch(`${base}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
    });
    if (!del.ok) {
      const text = await del.text();
      console.error('Account deletion failed:', text);
      return res.status(500).json({ error: 'Could not delete your account. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Account deletion error:', err);
    return res.status(500).json({ error: 'Could not delete your account. Please try again.' });
  }
};
