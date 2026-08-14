if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });

  // When a new service worker takes over (i.e. a new app version was just
  // deployed), the page that's already open is still running the OLD
  // cached JS/CSS. Reload once automatically so the user always ends up on
  // the version that matches what just activated, instead of a stale mix
  // of new HTML + old JS/CSS. `refreshing` guards against a reload loop.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// --- "Add to Home Screen" banner --------------------------------------
// Only ever shown on phones (CSS hides it above 768px) and never when the
// app is already installed/running standalone. Dismissal is remembered
// per-device for 14 days so it doesn't nag on every visit.
(() => {
  const DISMISS_KEY = 'mfp-install-dismissed';
  const DISMISS_DAYS = 14;

  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return;

  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  let deferredPrompt = null;

  function buildBanner({ onInstall, copy }) {
    const el = document.createElement('div');
    el.className = 'install-banner';
    el.innerHTML = `<div class="install-icon">F</div><div class="install-copy"><strong>Install Finora</strong><span>${copy}</span></div><div class="install-actions"></div>`;
    const actions = el.querySelector('.install-actions');
    if (onInstall) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'install-btn';
      btn.textContent = 'Install';
      btn.addEventListener('click', onInstall);
      actions.appendChild(btn);
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'install-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    });
    actions.appendChild(dismiss);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    return el;
  }

  if (isIOS) {
    // Safari never fires beforeinstallprompt — give a manual instruction instead.
    buildBanner({ onInstall: null, copy: 'Tap Share, then "Add to Home Screen"' });
    return;
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = buildBanner({
      copy: 'Add it to your home screen for the full app experience',
      onInstall: async () => {
        banner.remove();
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome !== 'accepted') localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    });
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  });
})();

