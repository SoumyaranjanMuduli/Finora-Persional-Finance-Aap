/**
 * Finora — in-app update checker.
 *
 * Bump CURRENT_VERSION here (and in package.json + version.json) on every
 * release. On click, or automatically once per session, this compares the
 * running app's version against /version.json on the server. If the server
 * is ahead, it shows the changelog and, on confirmation, activates the new
 * service worker (skipWaiting) and reloads — a real one-tap update, not a
 * cosmetic check. If the app isn't running as an installed PWA / has no
 * service worker, it falls back to a hard, cache-busted reload so the
 * browser still fetches the latest deployed files from Vercel.
 */
window.MFPUpdate = (() => {
  const CURRENT_VERSION = '1.1.2';
  const VERSION_URL = '/version.json';
  const CHECKED_KEY = 'mfp-update-last-check';
  const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  const parts = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
  const isNewer = (remote, local) => {
    const r = parts(remote), l = parts(local);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0, lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  };

  const fetchRemoteVersion = async () => {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`version.json ${res.status}`);
    return res.json();
  };

  let modalEl = null;
  const ensureModal = () => {
    if (modalEl) return modalEl;
    const el = document.createElement('div');
    el.className = 'update-modal';
    el.innerHTML = `
      <div class="update-modal-card" role="dialog" aria-modal="true" aria-labelledby="update-modal-title">
        <div class="update-modal-icon">⬆</div>
        <h2 id="update-modal-title">Update available</h2>
        <p class="update-modal-version"></p>
        <ul class="update-modal-changelog"></ul>
        <div class="update-modal-actions">
          <button type="button" class="secondary-btn full update-modal-later">Later</button>
          <button type="button" class="primary-btn full update-modal-install">Update Now</button>
        </div>
        <p class="update-modal-progress muted"></p>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.update-modal-later').addEventListener('click', () => closeModal());
    el.addEventListener('click', e => { if (e.target === el) closeModal(); });
    modalEl = el;
    return el;
  };
  const closeModal = () => { if (modalEl) modalEl.classList.remove('open'); };

  const applyUpdate = async () => {
    const el = ensureModal();
    const btn = el.querySelector('.update-modal-install');
    const progress = el.querySelector('.update-modal-progress');
    btn.disabled = true;
    el.querySelector('.update-modal-later').disabled = true;
    progress.textContent = 'Downloading update…';

    try {
      // 1. Purge cached static assets so nothing stale survives the reload.
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 2. Ask the service worker (if any) to fetch + activate the new build.
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          const waitForWaiting = () => new Promise(resolve => {
            if (reg.waiting) return resolve(reg.waiting);
            reg.addEventListener('updatefound', () => {
              const installing = reg.installing;
              if (!installing) return resolve(null);
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed') resolve(reg.waiting || installing);
              });
            });
            setTimeout(() => resolve(reg.waiting || null), 4000);
          });
          const worker = await waitForWaiting();
          if (worker) {
            progress.textContent = 'Installing…';
            worker.postMessage({ type: 'SKIP_WAITING' });
            await new Promise(resolve => {
              let done = false;
              navigator.serviceWorker.addEventListener('controllerchange', () => { done = true; resolve(); });
              setTimeout(() => { if (!done) resolve(); }, 3000);
            });
          }
        }
      }

      progress.textContent = 'Restarting Finora…';
      localStorage.setItem(CHECKED_KEY, String(Date.now()));
      setTimeout(() => location.reload(), 300);
    } catch (err) {
      console.error('Update failed:', err);
      progress.textContent = '';
      btn.disabled = false;
      el.querySelector('.update-modal-later').disabled = false;
      window.MFP?.toast('Could not install the update automatically. Reloading to fetch the latest version…', 'error');
      setTimeout(() => location.reload(), 1200);
    }
  };

  const showModal = info => {
    const el = ensureModal();
    el.querySelector('.update-modal-version').textContent =
      `${info.name || `Finora ${info.version}`} · ${info.released || ''}`;
    const list = el.querySelector('.update-modal-changelog');
    list.replaceChildren(...((info.changelog || []).map(line => { const li = document.createElement('li'); li.textContent = String(line); return li; })));
    if (!list.children.length) { const li = document.createElement('li'); li.textContent = 'General improvements and fixes.'; list.appendChild(li); }
    el.querySelector('.update-modal-install').onclick = applyUpdate;
    el.querySelector('.update-modal-install').disabled = false;
    el.querySelector('.update-modal-later').disabled = false;
    el.querySelector('.update-modal-progress').textContent = '';
    el.classList.add('open');
  };

  /**
   * @param {boolean} interactive - true when triggered by a user tap (shows
   * "you're up to date" / error toasts); false for silent background checks.
   */
  const check = async (interactive = false) => {
    try {
      const info = await fetchRemoteVersion();
      localStorage.setItem(CHECKED_KEY, String(Date.now()));
      if (isNewer(info.version, CURRENT_VERSION)) {
        showModal(info);
        return true;
      }
      if (interactive) window.MFP?.toast(`You're up to date — v${CURRENT_VERSION}`, 'success');
      return false;
    } catch (err) {
      console.warn('Update check failed:', err);
      if (interactive) window.MFP?.toast(navigator.onLine ? 'Could not check for updates. Try again later.' : 'You appear to be offline.', 'error');
      return false;
    }
  };

  const initAutoCheck = () => {
    const last = Number(localStorage.getItem(CHECKED_KEY) || 0);
    if (Date.now() - last > AUTO_CHECK_INTERVAL_MS) check(false);
  };

  return { CURRENT_VERSION, check, initAutoCheck };
})();

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('check-update-btn');
  const versionLabel = document.getElementById('app-version-label');
  if (versionLabel) versionLabel.textContent = `Version ${window.MFPUpdate.CURRENT_VERSION}`;
  if (btn) btn.addEventListener('click', () => window.MFPUpdate.check(true));
  // Quiet background check so users see the badge without tapping.
  window.MFPUpdate.initAutoCheck();
});
