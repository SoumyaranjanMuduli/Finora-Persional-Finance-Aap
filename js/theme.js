(() => {
  // Finora ships Light Mode by default, with an optional Velvet dark theme.
  const LIGHT_META = '#FBF2E6';
  const DARK_META = '#23274d';

  const saved = localStorage.getItem('mfp-theme') || 'dark';
  document.documentElement.dataset.theme = saved;

  function syncMetaColor(theme){
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? DARK_META : LIGHT_META);
  }
  syncMetaColor(saved);

  function syncToggleIcons(theme){
    if (!window.MFP || !window.MFP.icon) return;
    document.querySelectorAll('#theme-toggle, .theme-btn').forEach(btn => {
      const iconEl = btn.querySelector('.icon');
      const nextIcon = theme === 'dark' ? 'sun' : 'moon';
      if (iconEl) iconEl.outerHTML = window.MFP.icon(nextIcon);
    });
  }

  window.toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('mfp-theme', next);
    syncMetaColor(next);
    syncToggleIcons(next);
    document.dispatchEvent(new CustomEvent('themechange'));
  };

  document.addEventListener('DOMContentLoaded', () => {
    syncToggleIcons(document.documentElement.dataset.theme);
  });
})();
