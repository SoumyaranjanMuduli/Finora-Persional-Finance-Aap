document.querySelector('.password-toggle')?.addEventListener('click', e => {
  const i = document.querySelector('[name=password]');
  i.type = i.type === 'password' ? 'text' : 'password';
});
document.querySelector('#google-login')?.addEventListener('click', async () => {
  if (!mfpSupabase) return MFP.toast('Configure Supabase first.', 'error');
  const { error } = await mfpSupabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/dashboard.html' } });
  if (error) MFP.toast(error.message, 'error');
});
document.querySelector('#apple-login')?.addEventListener('click', async () => {
  if (!mfpSupabase) return MFP.toast('Configure Supabase first.', 'error');
  const { error } = await mfpSupabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: location.origin + '/dashboard.html' } });
  if (error) MFP.toast(error.message, 'error');
});
