/**
 * Client-side rate limiting for authentication attempts.
 * Tracks login/signup attempts per email address with exponential backoff.
 * 
 * Note: This is a UX improvement only. Server-side rate limiting via Supabase Auth
 * is the actual security control. This prevents hammering while reducing load.
 */
window.MFPRateLimit = (() => {
  const STORAGE_KEY = 'mfp-auth-attempts';
  const MAX_ATTEMPTS = 5;
  const INITIAL_BACKOFF_MS = 2000; // 2 seconds
  const MAX_BACKOFF_MS = 300000; // 5 minutes

  /**
   * Get current attempt record for an email
   * @param {string} email
   * @returns {object|null}
   */
  const getAttempts = (email) => {
    if (!email) return null;
    const key = email.toLowerCase().trim();
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    try {
      const attempts = JSON.parse(data);
      return attempts[key] || null;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  };

  /**
   * Record an auth attempt
   * @param {string} email
   * @param {boolean} success
   */
  const recordAttempt = (email, success) => {
    if (!email) return;
    const key = email.toLowerCase().trim();
    let attempts = {};
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        attempts = JSON.parse(data);
      } catch {
        attempts = {};
      }
    }

    if (success) {
      delete attempts[key];
    } else {
      const current = attempts[key] || { count: 0, lastAttempt: 0, backoffUntil: 0 };
      current.count = (current.count || 0) + 1;
      current.lastAttempt = Date.now();
      // Exponential backoff: 2s, 4s, 8s, 16s, 32s... capped at 5m
      current.backoffUntil = Date.now() + Math.min(
        INITIAL_BACKOFF_MS * Math.pow(2, Math.max(0, current.count - 1)),
        MAX_BACKOFF_MS
      );
      attempts[key] = current;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  };

  /**
   * Check if email is rate-limited
   * @param {string} email
   * @returns {object} { limited: boolean, remainingMs: number, message: string }
   */
  const check = (email) => {
    if (!email) return { limited: false, remainingMs: 0, message: '' };

    const record = getAttempts(email);
    if (!record) return { limited: false, remainingMs: 0, message: '' };

    const now = Date.now();

    // Still in backoff period
    if (now < record.backoffUntil) {
      const remainingMs = record.backoffUntil - now;
      const remainingSecs = Math.ceil(remainingMs / 1000);
      return {
        limited: true,
        remainingMs,
        message: `Too many attempts. Try again in ${remainingSecs}s.`
      };
    }

    // Backoff expired, but check if we've exceeded max attempts in the session
    if (record.count >= MAX_ATTEMPTS && now - record.lastAttempt < 3600000) { // 1 hour window
      const remainingMs = 60000; // Force 1 minute wait
      return {
        limited: true,
        remainingMs,
        message: `Too many failed attempts. Please try again later or reset your password.`
      };
    }

    return { limited: false, remainingMs: 0, message: '' };
  };

  /**
   * Clear rate limit for an email (after successful login)
   * @param {string} email
   */
  const clear = (email) => {
    if (!email) return;
    const key = email.toLowerCase().trim();
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;
    try {
      const attempts = JSON.parse(data);
      delete attempts[key];
      if (Object.keys(attempts).length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return { check, recordAttempt, clear };
})();
