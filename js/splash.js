(async () => {
  const session = window.mfpSupabase ? (await window.mfpSupabase.auth.getSession()).data.session : null;
  setTimeout(() => location.replace(session ? 'dashboard.html' : 'login.html'), 700);
})();
