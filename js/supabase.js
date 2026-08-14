(function () {
  const cfg = window.MFP_CONFIG || {};
  if (!cfg.supabaseUrl || cfg.supabaseUrl.includes('YOUR_PROJECT') || !cfg.supabasePublishableKey || cfg.supabasePublishableKey.includes('YOUR_')) {
    window.mfpSupabase = null;
    return;
  }
  window.mfpSupabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
