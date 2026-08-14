(() => {
  const sb = () => window.mfpSupabase;
  const form = MFP.$('#auth-form');
  const showConfigError = () => MFP.toast('Supabase is not configured. Add the browser URL and publishable key in js/config.runtime.js.', 'error');

  if (!sb()) {
    if (form || MFP.$('#forgot-form')) showConfigError();
    return;
  }

  const validPassword = value => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/.test(value);

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const mode = form.dataset.mode || 'login';
    const btn = MFP.$('button[type="submit"]', form);
    const email = MFP.$('[name="email"]', form)?.value.trim().toLowerCase();
    const password = MFP.$('[name="password"]', form)?.value || '';
    if (!email || !password) return MFP.toast('Enter your email and password.', 'error');
    if (mode === 'signup' && !validPassword(password)) return MFP.toast('Password must be 8–72 characters with uppercase, lowercase, number and symbol.', 'error');
    if (mode === 'signup' && password !== (MFP.$('[name="confirm_password"]', form)?.value || '')) return MFP.toast('Passwords do not match.', 'error');

    // Check client-side rate limiting (UX improvement, not security control)
    const rateLimitCheck = window.MFPRateLimit?.check(email);
    if (rateLimitCheck?.limited) {
      return MFP.toast(rateLimitCheck.message, 'error');
    }

    MFP.setLoading(btn, true, mode === 'signup' ? 'Creating...' : 'Signing in...');
    let res;
    try {
      if (mode === 'signup') {
        const name = MFP.$('[name="full_name"]', form)?.value.trim();
        const phone = MFP.$('[name="phone"]', form)?.value.trim() || null;
        res = await sb().auth.signUp({ email, password, options: { data: { full_name: name, phone, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata' } } });
      } else {
        res = await sb().auth.signInWithPassword({ email, password });
      }
    } catch (err) {
      MFP.setLoading(btn, false);
      window.MFPRateLimit?.recordAttempt(email, false);
      return MFP.toast('Authentication service is temporarily unavailable.', 'error');
    }
    MFP.setLoading(btn, false);
    if (res.error) {
      window.MFPRateLimit?.recordAttempt(email, false);
      const message = res.error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : res.error.message === 'Email not confirmed' ? 'Please verify your email before signing in.' : res.error.message;
      return MFP.toast(message, 'error');
    }

    if (mode === 'signup' && res.data.user?.identities?.length === 0) return MFP.toast('An account with this email already exists. Try logging in.', 'error');

    if (mode === 'signup' && !res.data.session) {
      MFP.toast('Account created. Check your email to verify your account, then log in.', 'success');
      return setTimeout(() => location.replace('login.html'), 900);
    }
    
    // Clear rate limit on successful auth
    window.MFPRateLimit?.clear(email);
    MFP.toast(mode === 'signup' ? 'Account created.' : 'Welcome back.', 'success');

    // On login, send the user straight to their Profile page to finish
    // setting up phone + gender if either is still missing — never to
    // Home with an incomplete profile.
    let destination = 'dashboard.html';
    try {
      const uid = res.data.user?.id;
      if (uid) {
        const { data: prof } = await sb().from('profiles').select('phone,gender').eq('user_id', uid).maybeSingle();
        if (!prof || !prof.phone || !prof.gender) destination = 'profile.html?onboarding=1';
      }
    } catch (err) { /* fall back to dashboard.html; app.js still gates access there */ }
    setTimeout(() => location.replace(destination), 300);
  });

  MFP.$('#forgot-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = MFP.$('[name="email"]', e.currentTarget).value.trim().toLowerCase();
    const btn = MFP.$('button[type="submit"]', e.currentTarget);
    MFP.setLoading(btn, true, 'Sending...');
    const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/forgot-password.html?reset=1` });
    MFP.setLoading(btn, false);
    if (error) return MFP.toast(error.message, 'error');
    MFP.toast('If the account exists, a reset link has been sent.', 'success');
  });

  const bindResetForm = () => {
    const resetForm = document.querySelector('#reset-form');
    if (!resetForm) return;
    resetForm.addEventListener('submit', async e => {
      e.preventDefault();
      const newPassword = resetForm.querySelector('[name="new_password"]')?.value || '';
      const confirmPassword = resetForm.querySelector('[name="confirm_password"]')?.value || '';
      if (!validPassword(newPassword)) return MFP.toast('Password must be 8–72 characters with uppercase, lowercase, number and symbol.', 'error');
      if (newPassword !== confirmPassword) return MFP.toast('Passwords do not match.', 'error');
      const btn = resetForm.querySelector('button[type="submit"]');
      MFP.setLoading(btn, true, 'Saving...');
      const { error } = await sb().auth.updateUser({ password: newPassword });
      MFP.setLoading(btn, false);
      if (error) return MFP.toast(error.message || 'Could not update password.', 'error');
      MFP.toast('Password updated. You can log in with your new password.', 'success');
      setTimeout(() => location.replace('login.html'), 900);
    });
  };

  const renderResetForm = () => {
    const resetCard = document.querySelector('.auth-card');
    if (!resetCard || document.querySelector('#reset-form')) return;
    resetCard.innerHTML = `<div class="auth-brand"><div class="auth-logo"><img class="app-logo" src="assets/images/logo.png" alt="Finora logo" width="48" height="48"></div><h1>Finora</h1><p>Track <b class="green">•</b> Save <b class="green">•</b> Grow</p></div><div style="text-align:center;margin-bottom:22px"><h2>Create New Password</h2><p class="muted">Choose a new password for your account.</p></div><form id="reset-form" class="auth-form"><div class="field"><label>New Password</label><input name="new_password" type="password" minlength="8" autocomplete="new-password" required placeholder="Enter your new password"></div><div class="field"><label>Confirm Password</label><input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required placeholder="Confirm your new password"></div><button class="primary-btn full" type="submit">Save New Password</button></form>`;
    bindResetForm();
  };

  sb().auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) renderResetForm();
  });

  const reset = new URLSearchParams(location.search).get('reset') === '1';
  if (reset && location.hash.includes('access_token')) renderResetForm();

  MFP.$$('.logout-btn').forEach(btn => btn.addEventListener('click', async () => { await sb().auth.signOut(); location.replace('login.html'); }));
})();
