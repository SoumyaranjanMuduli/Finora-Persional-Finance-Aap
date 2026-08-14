(async () => {
  const sb = window.mfpSupabase;
  const page = document.body.dataset.page || '';
  const resetFlow = page === 'forgot-password' && new URLSearchParams(location.search).get('reset') === '1';
  // Pages reachable without a session. Auth pages redirect an already-logged-in
  // user to the dashboard; neutral pages (legal, splash) never redirect either way.
  const authPages = new Set(['login', 'signup', 'forgot-password']);
  const neutralPages = new Set(['splash', 'terms', 'privacy']);
  const publicPages = new Set([...authPages, ...neutralPages]);
  if (!sb) {
    if (!publicPages.has(page)) location.replace('login.html');
    return;
  }
  const { data, error } = await sb.auth.getSession();
  if (error) {
    if (!publicPages.has(page)) location.replace('login.html');
    return;
  }
  if (!data.session && !publicPages.has(page)) {
    location.replace('login.html');
    return;
  }
  if (data.session && authPages.has(page) && !resetFlow) {
    try {
      const { data: prof } = await sb.from('profiles').select('phone,gender').eq('user_id', data.session.user.id).maybeSingle();
      location.replace(!prof || !prof.phone || !prof.gender ? 'profile.html?onboarding=1' : 'dashboard.html');
    } catch (err) {
      location.replace('dashboard.html');
    }
    return;
  }
  sb.auth.onAuthStateChange((_event, session) => {
    if (!session && !publicPages.has(page)) location.replace('login.html');
  });
})();
