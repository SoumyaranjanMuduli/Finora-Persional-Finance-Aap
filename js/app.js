(async () => {
  const sb = window.mfpSupabase;
  const page = document.body.dataset.page || '';
  if (!sb) return MFP.toast('Supabase is not configured. Add the browser URL and publishable key in js/config.runtime.js.', 'error');

  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) return;

    const uid = session.user.id;
    // Full set — powers the desktop sidebar, which has room for every
    // top-level section including Reports.
    const nav = [
      ['dashboard.html', 'home', 'Home', 'dashboard'],
      ['income.html', 'wallet', 'Income', 'income'],
      ['expenses.html', 'receipt', 'Expenses', 'expenses'],
      ['reports.html', 'chart', 'Reports', 'reports'],
      ['more.html', 'grid', 'More', 'more']
    ];
    // Mobile bottom dock — Reports is swapped for a raised centre "Quick Add"
    // button (Reports is still one tap away from More). This keeps the dock
    // to 5 balanced slots instead of crowding in a 6th icon.
    const bottomNav = [
      ['dashboard.html', 'home', 'Home', 'dashboard'],
      ['income.html', 'wallet', 'Income', 'income'],
      ['quick-add.html', 'plus', 'OPEX', 'quick-add'],
      ['expenses.html', 'receipt', 'Expenses', 'expenses'],
      ['more.html', 'grid', 'More', 'more']
    ];
    const icon = MFP.icon;

    // Live theme colors for Chart.js — read from CSS custom properties so
    // canvases always match the active Light / Velvet theme, including on
    // an in-session toggle (charts are simply re-rendered).
    const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const themePalette = () => [cssVar('--primary'), cssVar('--purple'), cssVar('--blue'), cssVar('--warning'), cssVar('--danger'), cssVar('--green')];

    const query = (table, opts = {}) => {
      let req = sb.from(table).select(opts.select || '*');
      for (const [key, value] of Object.entries(opts.eq || {})) req = req.eq(key, value);
      if (opts.gte) req = req.gte(opts.gte[0], opts.gte[1]);
      if (opts.lte) req = req.lte(opts.lte[0], opts.lte[1]);
      if (opts.order) req = req.order(opts.order[0], { ascending: opts.order[1] ?? false });
      if (opts.limit) req = req.limit(opts.limit);
      if (opts.range) req = req.range(opts.range[0], opts.range[1]);
      return req;
    };

    const fetchAll = async (table, opts = {}, pageSize = 500) => {
      const rows = [];
      for (let pageNo = 0; pageNo < 20; pageNo++) {
        const from = pageNo * pageSize;
        const { data, error } = await query(table, { ...opts, range: [from, from + pageSize - 1] });
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) return rows;
      }
      throw new Error('Too much data to load in one view. Narrow the date range and try again.');
    };

    const getProfile = async () => {
      const fallbackName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
      const { data, error } = await sb.from('profiles').select('*').eq('user_id', uid).maybeSingle();
      if (error) {
        console.warn('Profile lookup failed:', error.message);
        return { user_id: uid, full_name: fallbackName, phone: session.user.user_metadata?.phone || null };
      }
      if (data) return data;

      const { data: created, error: createError } = await sb.from('profiles').upsert({
        user_id: uid,
        full_name: fallbackName,
        phone: session.user.user_metadata?.phone || null
      }, { onConflict: 'user_id' }).select().single();
      if (createError) {
        console.warn('Profile bootstrap failed:', createError.message);
        return { user_id: uid, full_name: fallbackName, phone: session.user.user_metadata?.phone || null };
      }
      return created;
    };

    const profile = await getProfile();

    // Gate: a profile isn't "complete" until phone + gender are set. Every
    // authenticated page (other than the profile page itself) redirects
    // there until that's done, so a user can never land on Home with a
    // half-finished profile.
    const profileComplete = Boolean(profile.phone && profile.gender);
    if (!profileComplete && page && page !== 'profile') {
      location.replace('profile.html?onboarding=1');
      return;
    }
    const { data: pref, error: prefError } = await sb.from('user_preferences').select('theme,timezone,currency').eq('user_id', uid).maybeSingle();
    if (prefError) console.warn('Preferences lookup failed:', prefError.message);
    if (!pref) {
      await sb.from('user_preferences').upsert({ user_id: uid, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata' }, { onConflict: 'user_id' });
    }
    if (pref?.theme) {
      document.documentElement.dataset.theme = pref.theme;
      localStorage.setItem('mfp-theme', pref.theme);
    }
    MFP.setCurrency(pref?.currency || 'INR');

    const topLevelPages = new Set(nav.map(([, , , p]) => p));
    const effectiveNavPage = topLevelPages.has(page) ? page : 'more';
    const active = p => effectiveNavPage === p ? 'active' : '';
    const bottomTopLevelPages = new Set(bottomNav.map(([, , , p]) => p));
    const effectiveBottomPage = bottomTopLevelPages.has(page) ? page : 'more';
    const activeBottom = p => effectiveBottomPage === p ? 'active' : '';
    const initials = (profile.full_name || 'U').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    // Once gender is set, every avatar in the app (sidebar, topbar, profile
    // modal) shows the matching Male/Female icon instead of initials.
    const genderIcon = profile.gender === 'female' ? 'assets/images/female-user.png' : profile.gender === 'male' ? 'assets/images/male-user.png' : null;
    const avatarHtml = (size = 44) => genderIcon ? `<img class="avatar-img" src="${genderIcon}" alt="${MFP.esc(profile.full_name || 'User')}" width="${size}" height="${size}">` : MFP.esc(initials);
    const shell = MFP.$('#app');
    shell?.classList.add('app-shell');
    if (shell && !MFP.$('.sidebar', shell)) {
      const main = MFP.$('.main', shell);
      const sidebar = document.createElement('aside');
      sidebar.className = 'sidebar';
      sidebar.innerHTML = `<div class="brand"><div class="brand-mark"><img class="app-logo" src="assets/images/logo.png" alt="Finora logo" width="36" height="36"></div><div><strong>Finora</strong><small>Track • Save • Grow</small></div></div><nav class="side-nav" aria-label="Primary navigation">${nav.map(([href, ic, label, p]) => `<a class="${active(p)}" href="${href}" ${active(p) ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('')}</nav><div class="side-bottom"><button class="side-nav theme-btn" type="button" aria-label="Toggle theme">${icon('moon')}<span>Theme</span></button><a class="profile-mini" href="more.html"><div class="avatar">${avatarHtml(38)}</div><div style="min-width:0"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${MFP.esc(profile.full_name || 'User')}</strong><small class="muted">${MFP.esc(session.user.email || '')}</small></div></a><button class="secondary-btn full logout-btn" type="button">${icon('logout')} Logout</button></div>`;
      shell.insertBefore(sidebar, main || shell.firstChild);
      if (!MFP.$('.bottom-nav', shell)) {
        const bottom = document.createElement('nav');
        bottom.className = 'bottom-nav';
        bottom.setAttribute('aria-label', 'Mobile navigation');
        bottom.innerHTML = bottomNav.map(([href, ic, label, p]) => {
          const cls = activeBottom(p);
          return `<a class="${cls}" href="${href}" ${activeBottom(p) ? 'aria-current="page"' : ''} aria-label="${MFP.esc(label)}">${icon(ic)}<span>${label}</span></a>`;
        }).join('');
        shell.appendChild(bottom);
      }
      requestAnimationFrame(() => shell.classList.add('app-ready'));
    }

    // Topbar avatar + profile modal (Dashboard and Reports pages) — same
    // gender icon, plus the real name/email instead of the static
    // placeholders baked into the HTML.
    const userBtn = MFP.$('#user-btn');
    if (userBtn) userBtn.innerHTML = avatarHtml(44);
    const modalAvatar = MFP.$('.user-modal-avatar');
    if (modalAvatar) modalAvatar.innerHTML = avatarHtml(48);
    const modalName = MFP.$('#modal-name');
    if (modalName) modalName.textContent = profile.full_name || 'User';
    const modalEmail = MFP.$('#modal-email');
    if (modalEmail) modalEmail.textContent = session.user.email || '';

    const userModal = MFP.$('#user-modal');
    userBtn?.addEventListener('click', () => userModal?.classList.toggle('active'));
    userModal?.addEventListener('click', e => { if (e.target !== userBtn) userModal.classList.remove('active'); });

    MFP.$$('.theme-btn').forEach(btn => btn.addEventListener('click', () => window.toggleTheme?.()));
    MFP.$('#theme-toggle')?.addEventListener('click', () => window.toggleTheme?.());
    MFP.$$('.logout-btn').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error } = await sb.auth.signOut();
      if (error) return MFP.toast('Could not sign out. Please try again.', 'error');
      location.replace('login.html');
    }));
    document.addEventListener('themechange', async () => {
      const { error } = await sb.from('user_preferences').update({ theme: document.documentElement.dataset.theme }).eq('user_id', uid);
      if (error) console.error('Theme preference save failed', error);
    });

    const monthRange = (date = new Date()) => ({ start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 0) });
    const expenses = async (start = monthRange().start, end = monthRange().end) => fetchAll('expenses', {
      gte: ['expense_date', MFP.localDate(start)], lte: ['expense_date', MFP.localDate(end)], order: ['expense_date', false]
    });
    const incomes = async (start = monthRange().start, end = monthRange().end) => fetchAll('monthly_income', {
      gte: ['income_date', MFP.localDate(start)], lte: ['income_date', MFP.localDate(end)], order: ['income_date', false]
    });
    const salarySetting = async () => {
      const { data, error } = await sb.from('salary_settings').select('*').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      return data;
    };
    const categories = async () => {
      const { data, error } = await sb.from('expense_categories').select('*').eq('user_id', uid).order('name');
      if (error) throw error;
      return data || [];
    };
    const addExpense = row => sb.from('expenses').insert({ ...row, user_id: uid }).select().single();
    const addIncome = row => sb.from('monthly_income').insert({ ...row, user_id: uid }).select().single();
    const updateExpense = (id, row) => sb.from('expenses').update(row).eq('id', id).eq('user_id', uid);
    const deleteExpense = id => sb.from('expenses').delete().eq('id', id).eq('user_id', uid);

    const ensureSalaryForMonth = async () => {
      const s = await salarySetting();
      if (!s?.active) return s;
      const now = new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (now.getDate() < Math.min(s.salary_day, lastDay)) return s;
      const { error } = await sb.rpc('generate_salary_for_month', { p_month: MFP.localDate(new Date(now.getFullYear(), now.getMonth(), 1)) });
      if (error) throw error;
      return s;
    };

    const ensureRecurringExpensesForMonth = async () => {
      const now = new Date();
      const { error } = await sb.rpc('generate_recurring_expenses_for_month', { p_month: MFP.localDate(new Date(now.getFullYear(), now.getMonth(), 1)) });
      if (error) console.warn('Recurring expense generation failed:', error.message);
    };

    const animateNumber = (el, to, percent = false) => {
      if (!el) return;
      const target = Number(to) || 0;
      const start = performance.now();
      const duration = 550;
      const tick = now => {
        const progress = Math.min((now - start) / duration, 1);
        const value = target * (1 - Math.pow(1 - progress, 3));
        el.textContent = percent ? `${value.toFixed(2)}%` : MFP.money(value);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const renderRecent = rows => {
      const el = MFP.$('#recent-transactions');
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = `<div class="empty"><div class="empty-icon">${icon('receipt')}</div>No transactions recorded yet.<br><a class="link-btn" href="add-expense.html">Add Expense</a></div>`;
        return;
      }
      el.innerHTML = rows.slice(0, 7).map(r => `<div class="transaction"><div class="trans-icon expense-icon">${icon('receipt')}</div><div><div class="name">${MFP.esc(r.description || r.category_name || 'Expense')}</div><div class="desc">${MFP.esc(r.notes || r.category_name || '')}</div></div><div><div class="amount red">${MFP.money(r.amount)}</div><div class="date-small">${MFP.esc(r.expense_date)}</div></div><a class="menu-dot" href="expense-details.html?id=${encodeURIComponent(r.id)}" aria-label="Open expense">${icon('arrow')}</a></div>`).join('');
    };

    // Renders a doughnut chart into `donutId` (with an optional legend list
    // into `legendId`) and a horizontal bar chart of the same top categories
    // into `barId`, so pages can show "donut on the left, horizontal bar on
    // the right" from a single category breakdown. `listId`, if present, also
    // gets a text list (used on the Reports page where extra detail helps).
    const renderCategoryBreakdown = (rows, { donutId, legendId, barId, listId } = {}) => {
      const groups = {};
      rows.forEach(r => groups[r.category_name || 'Other Spend'] = (groups[r.category_name || 'Other Spend'] || 0) + MFP.num(r.amount));
      const total = MFP.sum(rows);
      const items = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const colors = themePalette();

      const legend = legendId && MFP.$(`#${legendId}`);
      if (legend) legend.innerHTML = items.length ? items.map(([name, value], i) => `<div class="legend-row"><div class="legend-left"><span class="dot" style="background:${colors[i]}"></span><span>${MFP.esc(name)}</span></div><strong>${MFP.money(value)}</strong></div>`).join('') : '<div class="empty">Add expenses to see your breakdown.</div>';

      const donut = donutId && MFP.$(`#${donutId}`);
      if (donut && window.Chart) {
        donut._chart?.destroy();
        donut._chart = items.length ? new Chart(donut, { type: 'doughnut', data: { labels: items.map(x => x[0]), datasets: [{ data: items.map(x => x[1]), backgroundColor: colors, borderWidth: 0 }] }, options: { cutout: '72%', animation: { duration: 650 }, plugins: { legend: { display: false } } } }) : null;
      }

      const bar = barId && MFP.$(`#${barId}`);
      if (bar && window.Chart) {
        bar._chart?.destroy();
        bar._chart = items.length ? new Chart(bar, {
          type: 'bar',
          data: { labels: items.map(x => x[0]), datasets: [{ data: items.map(x => x[1]), backgroundColor: colors, borderRadius: 6, barThickness: 22 }] },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 650 },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => MFP.money(ctx.parsed.x) } } },
            scales: {
              x: { beginAtZero: true, ticks: { color: cssVar('--muted2'), callback: v => MFP.money(v) }, grid: { color: cssVar('--line') } },
              y: { ticks: { color: cssVar('--muted2') }, grid: { display: false } }
            }
          }
        }) : null;
      }

      const list = listId && MFP.$(`#${listId}`);
      if (list) list.innerHTML = items.length ? items.map(([name, value], i) => `<div class="category-card"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${MFP.esc(name)}</strong><span>${MFP.money(value)}</span></div><div class="progress" style="color:${colors[i]}"><span style="width:${total ? value / total * 100 : 0}%"></span></div><small class="muted">${total ? (value / total * 100).toFixed(0) : 0}%</small></div>`).join('') : '<div class="empty">Add expenses to see your top categories.</div>';

      return { items, total };
    };

    async function dashboard() {
      const { start, end } = monthRange();

      // Greet the user immediately so the header never sits on the static
      // "Hello 👋" placeholder, even if something below fails.
      const firstName = profile.full_name?.trim().split(/\s+/)[0] || 'there';
      const helloEl = MFP.$('#hello-name');
      if (helloEl) helloEl.textContent = `Hello, ${firstName} 👋`;

      // These generate this month's salary / recurring-expense rows. They're
      // "nice to have" side effects of visiting the dashboard, not required
      // to display it — a failure here (e.g. a transient network error)
      // should never block the rest of the page from rendering.
      try { await ensureSalaryForMonth(); } catch (err) { console.warn('Salary generation skipped:', err.message); }
      try { await ensureRecurringExpensesForMonth(); } catch (err) { console.warn('Recurring expense generation skipped:', err.message); }

      try {
        const [ex, inc, sal] = await Promise.all([expenses(start, end), incomes(start, end), salarySetting()]);
        const totalExp = MFP.sum(ex);
        const totalInc = MFP.sum(inc);
        // "Total Salary" is every rupee of income recorded this month —
        // whether it came from the automatic Salary Settings entry or a
        // manually added income row. "Total Savings" is always derived as
        // Salary (Total Income) minus All Expenses, never stored on its own.
        const salary = totalInc;
        const savings = salary - totalExp;
        const rate = totalInc ? savings / totalInc * 100 : 0;
        animateNumber(MFP.$('#stat-income'), salary);
        animateNumber(MFP.$('#stat-expenses'), totalExp);
        animateNumber(MFP.$('#stat-savings'), savings);
        animateNumber(MFP.$('#stat-rate'), Math.max(0, rate), true);
        MFP.$('#salary-sub').textContent = sal ? `Salary ${sal.salary_day}${[11, 12, 13].includes(sal.salary_day) ? 'th' : sal.salary_day % 10 === 1 ? 'st' : sal.salary_day % 10 === 2 ? 'nd' : sal.salary_day % 10 === 3 ? 'rd' : 'th'} monthly` : 'Set your salary';
        const status = MFP.$('#status');
        status.innerHTML = `<div class="status-icon">${icon('clock')}</div><div class="grow"><strong>Checking today's details...</strong><p class="muted">One moment.</p></div><a class="primary-btn" href="daily-details.html">${icon('plus')} Add Today</a>`;
        const { data: ds, error: statusError } = await sb.from('daily_status').select('completed').eq('user_id', uid).eq('status_date', MFP.localDate()).maybeSingle();
        if (statusError) throw statusError;
        if (ds?.completed) status.innerHTML = `<div class="status-icon">${icon('check')}</div><div class="grow"><strong>Today's details completed ✓</strong><p class="muted">Great! You have recorded your expenses for today.</p></div><a class="secondary-btn" href="daily-details.html">View Today</a>`;
        else status.innerHTML = `<div class="status-icon">${icon('clock')}</div><div class="grow"><strong>Today's expense details haven't been added.</strong><p class="muted">Keep your daily spending history complete.</p></div><a class="primary-btn" href="daily-details.html">${icon('plus')} Add Today</a>`;
        renderRecent(ex);
        renderCategoryBreakdown(ex, { donutId: 'home-donut', legendId: 'home-legend', barId: 'home-bar' });
      } catch (err) {
        console.error(err);
        MFP.toast(navigator.onLine ? 'Could not load your dashboard. Please try again.' : 'You appear to be offline. Reconnect and try again.', 'error');
      }
    }

    async function incomePage() {
      try {
        await ensureSalaryForMonth();
        const [rows, sal] = await Promise.all([incomes(), salarySetting()]);
        MFP.$('#income-total').textContent = MFP.money(MFP.sum(rows));
        MFP.$('#salary-value').textContent = sal ? MFP.money(sal.monthly_salary) : 'Not set';
        MFP.$('#salary-day').textContent = sal ? `Every month on the ${sal.salary_day}${[11, 12, 13].includes(sal.salary_day) ? 'th' : sal.salary_day % 10 === 1 ? 'st' : sal.salary_day % 10 === 2 ? 'nd' : sal.salary_day % 10 === 3 ? 'rd' : 'th'}` : 'Set salary date';
        const el = MFP.$('#income-list');
        if (!rows.length) return el.innerHTML = '<div class="empty">No income recorded yet.<br><a class="link-btn" href="add-income.html">Add Income</a></div>';
        el.innerHTML = rows.map(r => `<div class="transaction"><div class="trans-icon income-icon">${icon('wallet')}</div><div><div class="name">${MFP.esc(r.source)}</div><div class="desc">${MFP.esc(r.description || 'Income')}</div></div><div><div class="amount green">${MFP.money(r.amount)}</div><div class="date-small">${MFP.esc(r.income_date)}</div></div><div class="row-actions"><a class="menu-dot" href="add-income.html?id=${encodeURIComponent(r.id)}" aria-label="Edit income">${icon('edit')}</a>${!r.is_salary ? `<button class="menu-dot income-delete" data-id="${MFP.esc(r.id)}" aria-label="Delete income">${icon('trash')}</button>` : ''}</div></div>`).join('');
        MFP.$$('.income-delete').forEach(btn => btn.addEventListener('click', async () => {
          if (!MFP.confirmAction('Delete this income?')) return;
          const { error } = await sb.from('monthly_income').delete().eq('id', btn.dataset.id).eq('user_id', uid);
          if (error) return MFP.toast('Could not delete income.', 'error');
          await incomePage();
          MFP.toast('Income deleted.', 'success');
        }));
      } catch (err) { console.error(err); MFP.toast('Could not load income.', 'error'); }
    }

    async function expensePage() {
      try {
        await ensureRecurringExpensesForMonth();
        const [rows, cats] = await Promise.all([expenses(), categories()]);
        const select = MFP.$('#expense-category-filter');
        const params = new URLSearchParams(location.search);
        const requestedCategory = params.get('category') || '';

        // Populate the dropdown from the user's real categories (defaults
        // + any custom ones), same source formPage() uses for Add Expense,
        // instead of a hard-coded chip list that drifts out of sync.
        if (select) {
          const customNames = cats.map(c => c.name).filter(name => !MFP.defaultCategories.includes(name));
          const names = [...MFP.defaultCategories.filter(n => n !== 'Other Spend'), ...customNames, 'Other Spend'];
          select.innerHTML = '<option value="">All Categories</option>' + names.map(name => `<option value="${MFP.esc(name)}">${MFP.esc(name)}</option>`).join('');
          if (requestedCategory && names.includes(requestedCategory)) select.value = requestedCategory;
        }

        const renderList = list => MFP.$('#expense-list').innerHTML = list.length
          ? list.map(r => `<div class="transaction"><div class="trans-icon expense-icon">${icon('receipt')}</div><div><div class="name">${MFP.esc(r.description || r.category_name || 'Expense')}</div><div class="desc">${MFP.esc(r.category_name || 'Other Spend')} ${r.payment_method ? `• ${MFP.esc(r.payment_method)}` : ''}</div></div><div><div class="amount red">${MFP.money(r.amount)}</div><div class="date-small">${MFP.esc(r.expense_date)}</div></div><a class="menu-dot" href="expense-details.html?id=${encodeURIComponent(r.id)}" aria-label="Open expense">${icon('arrow')}</a></div>`).join('')
          : `<div class="empty">${rows.length ? 'No expenses match your filters.' : 'No expenses recorded yet.<br><a class="danger-btn" href="add-expense.html">Add Expense</a>'}</div>`;

        const applyFilters = () => {
          const cat = select?.value || '';
          const q = (input?.value || '').trim().toLowerCase();
          const filtered = rows.filter(r =>
            (!cat || r.category_name === cat) &&
            (!q || (r.description || '').toLowerCase().includes(q) || (r.category_name || '').toLowerCase().includes(q))
          );
          MFP.$('#expense-total').textContent = MFP.money(MFP.sum(filtered));
          MFP.$('#expense-count').textContent = filtered.length;
          renderList(filtered);
        };

        const toggle = MFP.$('#expense-search-toggle');
        const wrap = MFP.$('#expense-search-wrap');
        const input = MFP.$('#expense-search');
        toggle?.addEventListener('click', () => {
          const show = wrap.style.display === 'none';
          wrap.style.display = show ? '' : 'none';
          if (show) input.focus(); else { input.value = ''; applyFilters(); }
        });
        input?.addEventListener('input', applyFilters);
        select?.addEventListener('change', () => {
          // Keep the URL in sync (so links/bookmarks to a category still
          // work) without a full page reload.
          const url = new URL(location.href);
          if (select.value) url.searchParams.set('category', select.value); else url.searchParams.delete('category');
          history.replaceState(null, '', url);
          applyFilters();
        });

        applyFilters();
      } catch (err) { console.error(err); MFP.toast('Could not load expenses.', 'error'); }
    }

    async function uploadReceipt(form) {
      const file = MFP.$('input[type=file]', form)?.files?.[0];
      if (!file) return null;
      if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Receipt must be JPG or PNG up to 5MB.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${uid}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await sb.storage.from('receipts').upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      return path;
    }

    async function formPage(type) {
      const form = MFP.$('#data-form');
      if (!form) return;
      const editId = new URLSearchParams(location.search).get('id');
      const dateInput = MFP.$('[name=income_date]', form) || MFP.$('[name=expense_date]', form);
      if (dateInput && !dateInput.value) dateInput.value = MFP.localDate();
      let expenseBackHref = 'expenses.html';

      if (type === 'expense') {
        // Back / Cancel / post-save should all return to wherever this page
        // was reached from — the subcategory list if we came from one,
        // otherwise expense history like before.
        const requestedCat = new URLSearchParams(location.search).get('category');
        if (requestedCat) expenseBackHref = `expense-category.html?category=${encodeURIComponent(requestedCat)}`;
        if (!editId && requestedCat) {
          const backLink = MFP.$('#add-expense-back');
          const cancelLink = MFP.$('#add-expense-cancel');
          if (backLink) backLink.href = expenseBackHref;
          if (cancelLink) cancelLink.href = expenseBackHref;
        }
        const cats = await categories();
        const sel = MFP.$('[name=category_name]', form);
        const subSel = MFP.$('[name=subcategory]', form);
        // Subcategory options depend on whichever main category is picked —
        // custom categories and 'Other Spend' just have none.
        const refreshSubcategories = (keepValue) => {
          if (!subSel) return;
          const prev = keepValue ?? subSel.value;
          const items = MFP.subcategoriesFor(sel?.value);
          subSel.innerHTML = '<option value="">Select Subcategory</option>' + items.map(([name]) => `<option value="${MFP.esc(name)}">${MFP.esc(name)}</option>`).join('');
          subSel.disabled = !items.length;
          if (prev && items.some(([name]) => name === prev)) subSel.value = prev;
        };
        if (sel) {
          const customNames = cats.map(c => c.name).filter(name => !MFP.defaultCategories.includes(name));
          const names = [...MFP.defaultCategories.filter(n => n !== 'Other Spend'), ...customNames, 'Other Spend'];
          sel.innerHTML = '<option value="">Select Category</option>' + names.map(name => `<option value="${MFP.esc(name)}">${MFP.esc(name)}</option>`).join('');
          const requested = new URLSearchParams(location.search).get('category');
          if (!editId && requested && names.includes(requested)) sel.value = requested;
          const requestedSub = new URLSearchParams(location.search).get('subcategory');
          refreshSubcategories(editId ? null : requestedSub);
          sel.addEventListener('change', () => refreshSubcategories());
        }
        if (editId) {
          const { data: r, error } = await sb.from('expenses').select('*').eq('id', editId).eq('user_id', uid).maybeSingle();
          if (error || !r) return MFP.toast('Expense not found.', 'error');
          for (const [key, value] of Object.entries({ category_name: r.category_name, amount: r.amount, expense_date: r.expense_date, description: r.description, payment_method: r.payment_method, notes: r.notes })) {
            const field = MFP.$(`[name="${key}"]`, form);
            if (field) field.value = value ?? '';
          }
          refreshSubcategories(r.subcategory);
          const btn = MFP.$('button[type=submit]', form);
          if (btn) btn.innerHTML = `${icon('edit')} Update Expense`;
        }
      }

      if (type === 'income' && editId) {
        const { data: r, error } = await sb.from('monthly_income').select('*').eq('id', editId).eq('user_id', uid).maybeSingle();
        if (error || !r) return MFP.toast('Income not found.', 'error');
        if (r.is_salary) return MFP.toast('Salary records are managed from Salary Settings.', 'error');
        for (const [key, value] of Object.entries({ source: r.source, amount: r.amount, income_date: r.income_date, payment_method: r.payment_method, description: r.description })) {
          const field = MFP.$(`[name="${key}"]`, form);
          if (field) field.value = value ?? '';
        }
      }

      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = MFP.$('button[type=submit]', form);
        MFP.setLoading(btn, true, editId ? 'Updating...' : 'Saving...');
        try {
          const fd = new FormData(form);
          if (type === 'income') {
            const payload = { amount: MFP.num(fd.get('amount')), source: String(fd.get('source') || '').trim(), income_date: fd.get('income_date'), description: fd.get('description') || null, payment_method: fd.get('payment_method') || null };
            if (!payload.source || payload.amount <= 0 || !payload.income_date) throw new Error('Enter a valid source, amount and date.');
            const res = editId ? await sb.from('monthly_income').update(payload).eq('id', editId).eq('user_id', uid) : await addIncome(payload);
            if (res.error) throw res.error;
            MFP.toast(editId ? 'Income updated.' : 'Income added.', 'success');
            return setTimeout(() => location.replace('income.html'), 250);
          }

          let receiptPath = null;
          if (type === 'custom-expense') receiptPath = await uploadReceipt(form);
          const payload = { amount: MFP.num(fd.get('amount')), category_name: String(fd.get('category_name') || '').trim(), expense_date: fd.get('expense_date'), description: fd.get('description') || null, notes: fd.get('notes') || null, payment_method: fd.get('payment_method') || null, subcategory: fd.get('subcategory') || null };
          if (!payload.category_name || payload.amount <= 0 || !payload.expense_date) throw new Error('Enter a valid category, amount and date.');
          if (receiptPath) payload.receipt_path = receiptPath;
          const res = editId ? await updateExpense(editId, payload) : await addExpense(payload);
          if (res.error) throw res.error;
          MFP.toast(editId ? 'Expense updated.' : 'Expense saved.', 'success');
          setTimeout(() => location.replace(editId ? 'expenses.html' : expenseBackHref), 250);
        } catch (err) {
          console.error(err);
          MFP.toast(err.message || 'Could not save your entry.', 'error');
        } finally { MFP.setLoading(btn, false); }
      });
    }

    async function salarySettingsPage() {
      const form = MFP.$('#salary-form');
      if (!form) return;
      const { data: s, error } = await sb.from('salary_settings').select('*').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      if (s) {
        MFP.$('[name=monthly_salary]', form).value = s.monthly_salary;
        MFP.$('[name=salary_day]', form).value = s.salary_day;
      }
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const salary = MFP.num(fd.get('monthly_salary'));
        const day = Number(fd.get('salary_day'));
        if (salary <= 0 || day < 1 || day > 31) return MFP.toast('Enter a valid salary and salary date.', 'error');
        const btn = MFP.$('button[type=submit]', form);
        MFP.setLoading(btn, true, 'Saving...');
        try {
          const res = await sb.from('salary_settings').upsert({ user_id: uid, monthly_salary: salary, salary_day: day, active: true }, { onConflict: 'user_id' });
          if (res.error) throw res.error;
          const now = new Date();
          if (now.getDate() >= day) {
            const generated = await sb.rpc('generate_salary_for_month', { p_month: MFP.localDate(new Date(now.getFullYear(), now.getMonth(), 1)) });
            if (generated.error) throw generated.error;
          }
          MFP.toast('Salary settings saved.', 'success');
        } catch (err) { console.error(err); MFP.toast(err.message || 'Could not save salary settings.', 'error'); }
        finally { MFP.setLoading(btn, false); }
      });
    }

    async function notificationsPage() {
      const { data, error } = await sb.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const el = MFP.$('#notification-list');
      el.innerHTML = (data || []).length ? data.map(n => `<div class="transaction ${n.read_at ? '' : 'unread'}"><div class="trans-icon income-icon">${icon('bell')}</div><div><div class="name">${MFP.esc(n.title)}</div><div class="desc">${MFP.esc(n.message)}</div></div><div class="date-small">${MFP.esc(new Date(n.created_at).toLocaleString('en-IN'))}</div><button class="menu-dot" data-read="${MFP.esc(n.id)}" aria-label="Mark notification as read">${n.read_at ? icon('check') : '•'}</button></div>`).join('') : '<div class="empty">No notifications.</div>';
      MFP.$$('[data-read]').forEach(btn => btn.addEventListener('click', async () => {
        const { error: updateError } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', btn.dataset.read).eq('user_id', uid);
        if (updateError) return MFP.toast('Could not update notification.', 'error');
        btn.innerHTML = icon('check');
        btn.closest('.transaction')?.classList.remove('unread');
      }));
      MFP.$('#mark-all-read')?.addEventListener('click', async () => {
        const { error: updateError } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null);
        if (updateError) return MFP.toast('Could not update notifications.', 'error');
        await notificationsPage();
      });
    }

    async function dailyPage() {
      const form = MFP.$('#daily-form');
      if (!form) return;
      const cats = ['Bus Travel', 'Cab Travel', 'Online Travel', 'Grocery', 'Other Spend', 'Room Rent'];
      const today = MFP.localDate();
      const dateEl = MFP.$('#today-date');
      if (dateEl) dateEl.textContent = new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' });
      const { data: existing, error: statusError } = await sb.from('daily_status').select('*').eq('user_id', uid).eq('status_date', today).maybeSingle();
      if (statusError) throw statusError;
      const { data: dailyRows, error: dailyError } = await sb.from('expenses').select('category_name,amount').eq('user_id', uid).eq('expense_date', today).like('description', 'Daily %');
      if (dailyError) throw dailyError;
      const values = Object.fromEntries(cats.map(c => [c, MFP.sum((dailyRows || []).filter(r => r.category_name === c))]));
      form.innerHTML = cats.map(name => `<div class="detail-row"><div class="status-icon">${icon(name === 'Bus Travel' ? 'bus' : name === 'Cab Travel' ? 'car' : name === 'Online Travel' ? 'plane' : name === 'Grocery' ? 'cart' : name === 'Room Rent' ? 'rent' : 'more')}</div><div><strong>${name}</strong><div class="muted" style="font-size:12px">Daily ${name.toLowerCase()}</div></div><div class="field" style="min-width:120px"><input name="${MFP.esc(name)}" type="number" step="0.01" min="0" value="${values[name]}" aria-label="${MFP.esc(name)} amount"></div></div>`).join('') + `<div class="field" style="margin-top:12px"><label>Notes (Optional)</label><textarea name="notes" placeholder="Add a note...">${MFP.esc(existing?.notes || '')}</textarea></div><button type="submit" class="primary-btn full" style="margin-top:12px">${icon('save')} Save Today's Details</button>`;

      const save = async markZero => {
        const btn = MFP.$('button[type=submit]', form);
        const entries = cats.map(category => ({ category_name: category, amount: markZero ? 0 : MFP.num(new FormData(form).get(category)) }));
        if (!markZero && entries.every(x => x.amount === 0)) return MFP.toast('Enter at least one amount or use Mark All as ₹0.', 'error');
        MFP.setLoading(btn, true, 'Saving...');
        try {
          const { error } = await sb.rpc('save_daily_details', { p_date: today, p_notes: new FormData(form).get('notes') || null, p_entries: entries });
          if (error) throw error;
          MFP.toast(markZero ? 'Today marked complete with ₹0.' : 'Today is marked complete.', 'success');
          setTimeout(() => location.replace('dashboard.html'), 250);
        } catch (err) { console.error(err); MFP.toast(err.message || 'Could not save daily details.', 'error'); }
        finally { MFP.setLoading(btn, false); }
      };
      MFP.$$('[data-mark-zero]').forEach(btn => btn.addEventListener('click', () => save(true)));
      form.addEventListener('submit', e => { e.preventDefault(); save(false); });
    }

    async function detailPage() {
      const id = new URLSearchParams(location.search).get('id');
      if (!id) return MFP.toast('Expense ID is missing.', 'error');
      const { data: r, error } = await sb.from('expenses').select('*').eq('id', id).eq('user_id', uid).maybeSingle();
      if (error || !r) return MFP.toast('Expense not found.', 'error');
      let receiptHtml = '';
      if (r.receipt_path) {
        const { data: signed, error: signedError } = await sb.storage.from('receipts').createSignedUrl(r.receipt_path, 300);
        if (!signedError && signed?.signedUrl) receiptHtml = `<div class="card" style="padding:16px;margin-top:16px"><strong>Receipt</strong><div style="margin-top:10px"><a class="secondary-btn" target="_blank" rel="noopener noreferrer" href="${MFP.esc(signed.signedUrl)}">${icon('eye')} View receipt</a></div></div>`;
      }
      MFP.$('#detail').innerHTML = `<div class="detail-hero card"><div><div class="pill">${MFP.esc(r.category_name || 'Expense')}</div><h1 style="margin-top:10px">${MFP.esc(r.description || 'Expense')}</h1><p class="muted" style="margin-top:6px">${MFP.esc(r.expense_date)}</p></div><div style="text-align:right"><div class="muted">Amount</div><div class="detail-amount red">${MFP.money(r.amount)}</div></div></div><div class="section-title"><h2>Details</h2></div><div class="card detail-list"><div class="detail-row"><div class="status-icon">${icon('grid')}</div><div>Category</div><div class="right">${MFP.esc(r.category_name || '—')}</div></div><div class="detail-row"><div class="status-icon">${icon('wallet')}</div><div>Payment Method</div><div class="right">${MFP.esc(r.payment_method || '—')}</div></div><div class="detail-row"><div class="status-icon">${icon('receipt')}</div><div>Description</div><div class="right">${MFP.esc(r.description || '—')}</div></div><div class="detail-row"><div class="status-icon">${icon('tag')}</div><div>Subcategory</div><div class="right">${MFP.esc(r.subcategory || '—')}</div></div><div class="detail-row"><div class="status-icon">${icon('info')}</div><div>Notes</div><div class="right">${MFP.esc(r.notes || '—')}</div></div></div>${receiptHtml}<div class="form-actions" style="margin-top:16px"><button class="secondary-btn" id="delete-expense" type="button">${icon('trash')} Delete</button><a class="danger-btn" href="add-expense.html?id=${encodeURIComponent(r.id)}">${icon('edit')} Edit Expense</a></div>`;
      MFP.$('#delete-expense').addEventListener('click', async () => {
        if (!MFP.confirmAction('Delete this expense? This cannot be undone.')) return;
        if (r.receipt_path) await sb.storage.from('receipts').remove([r.receipt_path]);
        const res = await deleteExpense(id);
        if (res.error) return MFP.toast('Could not delete expense.', 'error');
        MFP.toast('Expense deleted.', 'success');
        setTimeout(() => location.replace('expenses.html'), 250);
      });
    }

    // Renders the two compare bar charts on the Reports page for a given
    // category (empty string = all categories): this-month-so-far vs the
    // same period last month, and yesterday vs today.
    const renderCompare = async (categoryName) => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);

      const [thisMonthEx, prevMonthEx] = await Promise.all([
        expenses(thisMonthStart, now),
        expenses(prevMonthStart, prevMonthEnd)
      ]);
      const inCategory = rows => categoryName ? rows.filter(r => r.category_name === categoryName) : rows;
      const thisMonthTotal = MFP.sum(inCategory(thisMonthEx));
      const prevMonthTotal = MFP.sum(inCategory(prevMonthEx));

      const todayStr = MFP.localDate(now);
      const yestStr = MFP.localDate(yesterday);
      const todayTotal = MFP.sum(inCategory(thisMonthEx).filter(r => r.expense_date === todayStr));
      // Yesterday's rows live in thisMonthEx unless "today" is the 1st of
      // the month, in which case yesterday falls in last month's data.
      const yestTotal = MFP.sum(inCategory([...thisMonthEx, ...prevMonthEx]).filter(r => r.expense_date === yestStr));

      const setText = (id, value) => { const el = MFP.$(`#${id}`); if (el) el.textContent = MFP.money(value); };
      setText('cmp-prev-month', prevMonthTotal);
      setText('cmp-this-month', thisMonthTotal);
      setText('cmp-yesterday', yestTotal);
      setText('cmp-today', todayTotal);

      const colors = themePalette();
      const drawCompareChart = (canvasId, labels, values) => {
        const canvas = MFP.$(`#${canvasId}`);
        if (!canvas || !window.Chart) return;
        canvas._chart?.destroy();
        canvas._chart = new Chart(canvas, {
          type: 'bar',
          data: { labels, datasets: [{ data: values, backgroundColor: [colors[2], colors[0]], borderRadius: 10, barThickness: 46 }] },
          options: {
            responsive: true, maintainAspectRatio: false, animation: { duration: 550 },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => MFP.money(ctx.parsed.y) } } },
            scales: {
              y: { beginAtZero: true, ticks: { color: cssVar('--muted2'), callback: v => MFP.money(v) }, grid: { color: cssVar('--line') } },
              x: { ticks: { color: cssVar('--muted2') }, grid: { display: false } }
            }
          }
        });
      };
      drawCompareChart('compare-month-chart', ['Previous Month', 'This Month'], [prevMonthTotal, thisMonthTotal]);
      drawCompareChart('compare-day-chart', ['Yesterday', 'Today'], [yestTotal, todayTotal]);
    };

    async function reports() {
      if (!window.Chart) return MFP.toast('Chart.js failed to load. Refresh and try again.', 'error');
      try {
        const { start, end } = monthRange();
        const ex = await expenses(start, end);
        // Donut on the left, horizontal bar chart on the right — both driven
        // by the same this-month category breakdown — plus a detailed list
        // and the recent transactions feed underneath.
        renderCategoryBreakdown(ex, { donutId: 'report-donut', legendId: 'donut-legend', barId: 'report-bar', listId: 'top-categories' });
        renderRecent(ex);

        // Compare section: populate the category picker from the user's
        // saved categories plus any category name seen in this/last month's
        // expenses (covers one-off custom categories too), then render the
        // month and day comparisons for whichever category is selected.
        const select = MFP.$('#compare-category');
        if (select) {
          const prevMonthStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
          const prevMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);
          const [cats, prevEx] = await Promise.all([categories(), expenses(prevMonthStart, prevMonthEnd)]);
          const names = new Set([...cats.map(c => c.name), ...ex.map(r => r.category_name), ...prevEx.map(r => r.category_name)].filter(Boolean));
          const current = select.value;
          select.innerHTML = '<option value="">All Categories</option>' + [...names].sort().map(name => `<option value="${MFP.esc(name)}">${MFP.esc(name)}</option>`).join('');
          if (current && names.has(current)) select.value = current;
          if (!select.dataset.bound) {
            select.dataset.bound = '1';
            select.addEventListener('change', () => renderCompare(select.value));
          }
        }
        await renderCompare(select ? select.value : '');
      } catch (err) { console.error(err); MFP.toast(err.message || 'Could not load reports.', 'error'); }
    }

    async function grocery() {
      const dateInput = MFP.$('[name=item_date]');
      if (dateInput && !dateInput.value) dateInput.value = MFP.localDate();
      const { start, end } = monthRange();
      const { data, error } = await sb.from('grocery_items').select('*').eq('user_id', uid).gte('item_date', MFP.localDate(start)).lte('item_date', MFP.localDate(end)).order('item_date', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      MFP.$('#grocery-total').textContent = MFP.money(MFP.sum(rows, 'price'));
      MFP.$('#grocery-count').textContent = rows.length;
      MFP.$('#grocery-list').innerHTML = rows.length ? rows.map(r => `<div class="transaction"><div class="trans-icon income-icon">${icon('cart')}</div><div><div class="name">${MFP.esc(r.item_name)}</div><div class="desc">${MFP.esc(r.quantity ?? '')} ${MFP.esc(r.unit ?? '')}</div></div><div><div class="amount green">${MFP.money(r.price)}</div><div class="date-small">${MFP.esc(r.item_date)}</div></div><a class="menu-dot" href="expense-details.html?id=${encodeURIComponent(r.expense_id || '')}" aria-label="Open grocery expense">${icon('arrow')}</a></div>`).join('') : '<div class="empty">No grocery items this month.</div>';
      MFP.$('#grocery-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const price = MFP.num(fd.get('price'));
        if (!String(fd.get('item_name') || '').trim() || price <= 0 || !fd.get('item_date')) return MFP.toast('Enter item, price and date.', 'error');
        const res = await sb.rpc('add_grocery_item', { p_item_name: String(fd.get('item_name')).trim(), p_quantity: fd.get('quantity') ? MFP.num(fd.get('quantity')) : null, p_unit: fd.get('unit'), p_price: price, p_date: fd.get('item_date'), p_notes: fd.get('notes') || null });
        if (res.error) return MFP.toast(res.error.message, 'error');
        MFP.toast('Grocery item added.', 'success');
        location.reload();
      });
    }

    async function categoriesPage() {
      const form = MFP.$('#category-form');
      const list = MFP.$('#category-list');
      if (!form || !list) return;
      const load = async () => {
        const { data, error } = await sb.from('expense_categories').select('*').eq('user_id', uid).order('is_default', { ascending: false }).order('name');
        if (error) throw error;
        const rows = data || [];
        list.innerHTML = rows.length ? rows.map(c => `<div class="card" style="padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="display:flex;align-items:center;gap:12px"><span style="width:14px;height:14px;border-radius:50%;background:${/^#[0-9A-Fa-f]{6}$/.test(c.color || '') ? c.color : '#FF7A50'};display:inline-block"></span><strong>${MFP.esc(c.name)}</strong>${c.is_default ? '<span class="pill">Default</span>' : ''}</div>${c.is_default ? '' : `<button class="menu-dot category-delete" data-id="${MFP.esc(c.id)}" data-name="${MFP.esc(c.name)}" aria-label="Delete category">${icon('trash')}</button>`}</div>`).join('') : '<div class="empty">No categories yet.</div>';
        MFP.$$('.category-delete', list).forEach(btn => btn.addEventListener('click', async () => {
          if (!MFP.confirmAction(`Delete "${btn.dataset.name}"? Existing expenses keep their category name; only future dropdowns are affected.`)) return;
          const { error: delError } = await sb.from('expense_categories').delete().eq('id', btn.dataset.id).eq('user_id', uid);
          if (delError) return MFP.toast('Could not delete category.', 'error');
          MFP.toast('Category deleted.', 'success');
          await load();
        }));
      };
      await load();
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = MFP.$('button[type=submit]', form);
        MFP.setLoading(btn, true, 'Adding...');
        try {
          const fd = new FormData(form);
          const name = String(fd.get('name') || '').trim();
          const color = String(fd.get('color') || '#FF7A50').trim();
          if (!name) throw new Error('Enter a category name.');
          if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error('Choose a valid 6-digit hex color.');
          const { error } = await sb.from('expense_categories').insert({ user_id: uid, name, color, is_default: false });
          if (error) throw error.code === '23505' ? new Error('You already have a category with that name.') : error;
          form.reset();
          MFP.$('[name=color]', form).value = '#FF7A50';
          MFP.toast('Category added.', 'success');
          await load();
        } catch (err) {
          console.error(err);
          MFP.toast(err.message || 'Could not add category.', 'error');
        } finally { MFP.setLoading(btn, false); }
      });
    }

    async function quickAddPage() {
      const grid = MFP.$('#quick-add-categories');
      if (!grid) return;
      const search = MFP.$('#quick-add-search');
      const toggle = MFP.$('#quick-add-search-toggle');
      const wrap = MFP.$('#quick-add-search-wrap');

      toggle?.addEventListener('click', () => {
        const showing = wrap.style.display !== 'none';
        wrap.style.display = showing ? 'none' : 'block';
        if (!showing) search?.focus(); else { if (search) search.value = ''; filter(); }
      });

      const custom = await categories();
      const customNames = custom.map(c => c.name);
      const groupData = MFP.expenseGroups || [];
      // Custom categories don't belong to a main group, so they get treated
      // as their own single-item card.
      const customGroup = customNames.filter(name => !MFP.defaultCategories.includes(name));

      // One card per main category (Browse Categories), not one per
      // subcategory — tapping a card drills into expense-category.html for
      // that group, where the individual subcategories live.
      grid.innerHTML = '<div class="quick-add-grid quick-add-grid-2col">' + groupData.map(group => `
        <a class="quick-add-category-card" href="expense-category.html?category=${encodeURIComponent(group.name)}" data-search="${MFP.esc(`${group.name} ${group.items.map(i => i[0]).join(' ')}`.toLowerCase())}">
          <span class="quick-add-category-card-icon">${icon(group.icon)}</span>
          <strong>${MFP.esc(group.name)}</strong>
          <p class="muted">${MFP.esc(group.description || '')}</p>
          <span class="quick-add-category-card-count">${group.items.length} options</span>
        </a>`).join('') +
        customNames.filter(n => customGroup.includes(n)).map(name => `
          <a class="quick-add-category-card" href="add-expense.html?category=${encodeURIComponent(name)}" data-search="${MFP.esc(name.toLowerCase())}">
            <span class="quick-add-category-card-icon">${icon(MFP.categoryIcon(name))}</span>
            <strong>${MFP.esc(name)}</strong>
            <p class="muted">Custom category</p>
          </a>`).join('') +
      '</div>';

      const noResults = MFP.$('#quick-add-no-results');
      const filter = () => {
        const q = (search?.value || '').trim().toLowerCase();
        const cards = MFP.$$('.quick-add-category-card', grid);
        let anyVisible = false;
        cards.forEach(card => {
          const match = !q || (card.dataset.search || '').includes(q);
          card.style.display = match ? '' : 'none';
          if (match) anyVisible = true;
        });
        if (noResults) noResults.style.display = q && !anyVisible ? 'flex' : 'none';
      };
      search?.addEventListener('input', filter);
    }

    async function expenseCategoryPage() {
      const title = MFP.$('#category-title');
      const groupTitle = MFP.$('#category-group');
      const heading = MFP.$('#category-heading');
      const desc = MFP.$('#category-description');
      const itemsEl = MFP.$('#category-items');
      const iconEl = MFP.$('#category-icon');
      const add = MFP.$('#add-category-expense');
      if (!itemsEl) return;

      // This page is keyed by MAIN category now (?category=Transport), not
      // by subcategory — tapping a subcategory tile below jumps straight to
      // Add Expense with both fields prefilled, it doesn't come back here.
      const requested = new URLSearchParams(location.search).get('category') || '';
      const groups = MFP.expenseGroups || [];
      const custom = await categories();
      const customNames = custom.map(c => c.name);

      let group = MFP.groupByName(requested);
      const isCustom = !group && customNames.some(n => n.toLowerCase() === requested.toLowerCase());
      if (isCustom) {
        const name = customNames.find(n => n.toLowerCase() === requested.toLowerCase());
        group = { name, icon: MFP.categoryIcon(name), description: 'Custom category', items: [] };
      }
      if (!group) group = groups[0];

      document.title = `${group.name} • Finora`;
      if (title) title.textContent = group.name;
      if (groupTitle) groupTitle.textContent = 'Choose exactly what you spent on';
      if (heading) heading.textContent = group.name;
      if (desc) desc.textContent = group.description || `Manage ${group.name.toLowerCase()} expenses.`;
      if (iconEl) iconEl.innerHTML = icon(group.icon || MFP.categoryIcon(group.name));
      // A custom category has no subcategories, so its own "Add Expense"
      // button just carries the category through.
      if (add) add.href = `add-expense.html?category=${encodeURIComponent(group.name)}`;

      itemsEl.innerHTML = group.items.length ? group.items.map(([name, ic]) => `
        <a class="category-item" data-search="${MFP.esc(name.toLowerCase())}" href="add-expense.html?category=${encodeURIComponent(group.name)}&subcategory=${encodeURIComponent(name)}">
          <span class="category-item-icon">${icon(ic || MFP.categoryIcon(name))}</span><span>${MFP.esc(name)}</span>
        </a>`).join('') : '<div class="empty">No subcategories — use "Add Expense" below.</div>';

      const search = MFP.$('#category-search');
      search?.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        MFP.$$('.category-item', itemsEl).forEach(el => {
          el.style.display = !q || (el.dataset.search || '').includes(q) ? '' : 'none';
        });
      });
    }

    async function recurringPage() {
      const form = MFP.$('#recurring-form');
      const list = MFP.$('#recurring-list');
      if (!form || !list) return;
      const cats = await categories();
      const sel = MFP.$('[name=category_name]', form);
      if (sel) {
        const names = [...new Set(cats.map(c => c.name).concat('Other Spend'))];
        sel.innerHTML = '<option value="">Select Category</option>' + names.map(name => `<option value="${MFP.esc(name)}">${MFP.esc(name)}</option>`).join('');
      }
      const ordinal = d => `${d}${[11, 12, 13].includes(d) ? 'th' : d % 10 === 1 ? 'st' : d % 10 === 2 ? 'nd' : d % 10 === 3 ? 'rd' : 'th'}`;
      const load = async () => {
        const { data, error } = await sb.from('recurring_expenses').select('*').eq('user_id', uid).order('active', { ascending: false }).order('day_of_month');
        if (error) throw error;
        const rows = data || [];
        list.innerHTML = rows.length ? rows.map(r => `<div class="card" style="padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;opacity:${r.active ? '1' : '.55'}"><div><strong>${MFP.esc(r.category_name)}${r.subcategory ? ` • ${MFP.esc(r.subcategory)}` : ''}</strong><div class="muted">${MFP.money(r.amount)} on the ${ordinal(r.day_of_month)} of every month${r.active ? '' : ' • Paused'}</div></div><div style="display:flex;gap:8px"><button class="menu-dot recurring-toggle" data-id="${MFP.esc(r.id)}" data-active="${r.active}" aria-label="${r.active ? 'Pause' : 'Resume'}">${icon(r.active ? 'clock' : 'refresh')}</button><button class="menu-dot recurring-delete" data-id="${MFP.esc(r.id)}" aria-label="Delete recurring expense">${icon('trash')}</button></div></div>`).join('') : '<div class="empty">No recurring expenses yet. Add subscriptions, EMIs or bills above and they\'ll be added to your expenses automatically each month.</div>';
        MFP.$$('.recurring-toggle', list).forEach(btn => btn.addEventListener('click', async () => {
          const { error: toggleError } = await sb.from('recurring_expenses').update({ active: btn.dataset.active !== 'true' }).eq('id', btn.dataset.id).eq('user_id', uid);
          if (toggleError) return MFP.toast('Could not update recurring expense.', 'error');
          await load();
        }));
        MFP.$$('.recurring-delete', list).forEach(btn => btn.addEventListener('click', async () => {
          if (!MFP.confirmAction('Delete this recurring expense? Past auto-generated expenses stay in your history.')) return;
          const { error: delError } = await sb.from('recurring_expenses').delete().eq('id', btn.dataset.id).eq('user_id', uid);
          if (delError) return MFP.toast('Could not delete recurring expense.', 'error');
          MFP.toast('Recurring expense deleted.', 'success');
          await load();
        }));
      };
      await load();
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = MFP.$('button[type=submit]', form);
        MFP.setLoading(btn, true, 'Adding...');
        try {
          const fd = new FormData(form);
          const payload = {
            user_id: uid,
            category_name: String(fd.get('category_name') || '').trim(),
            subcategory: fd.get('subcategory') || null,
            amount: MFP.num(fd.get('amount')),
            day_of_month: Math.round(MFP.num(fd.get('day_of_month'))),
            payment_method: fd.get('payment_method') || null,
            notes: fd.get('notes') || null
          };
          if (!payload.category_name || payload.amount <= 0) throw new Error('Enter a valid category and amount.');
          if (payload.day_of_month < 1 || payload.day_of_month > 31) throw new Error('Day of month must be between 1 and 31.');
          const { error } = await sb.from('recurring_expenses').insert(payload);
          if (error) throw error;
          form.reset();
          MFP.toast('Recurring expense added.', 'success');
          await load();
        } catch (err) {
          console.error(err);
          MFP.toast(err.message || 'Could not add recurring expense.', 'error');
        } finally { MFP.setLoading(btn, false); }
      });
    }

    async function budgetsPage() {
      const form = MFP.$('#budget-form');
      const list = MFP.$('#budget-list');
      const month = MFP.monthKey() + '-01';
      const { data: cats, error: catError } = await sb.from('expense_categories').select('id,name').eq('user_id', uid).order('name');
      if (catError) throw catError;
      const sel = MFP.$('[name=category_name]', form);
      if (sel) {
        const customNames = (cats || []).map(c => c.name).filter(name => !MFP.defaultCategories.includes(name));
        const budgetNames = [...MFP.defaultCategories.filter(n => n !== 'Other Spend'), ...customNames, 'Other Spend'];
        sel.innerHTML = '<option value="">Select category</option>' + budgetNames.map(name => `<option value="${MFP.esc(name)}">${MFP.esc(name)}</option>`).join('');
      }
      const load = async () => {
        const { data, error } = await sb.from('budgets').select('*').eq('user_id', uid).eq('month_start', month).order('category_name');
        if (error) throw error;
        const rows = data || [];
        if (!rows.length) return list.innerHTML = '<div class="empty">No budgets for this month.</div>';
        const start = new Date(month), end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        const ex = await expenses(start, end);
        list.innerHTML = rows.map(b => {
          const spent = MFP.sum(ex.filter(r => r.category_name === b.category_name));
          const pct = Math.min(100, b.monthly_limit ? spent / b.monthly_limit * 100 : 0);
          return `<div class="card budget-row"><div><strong>${MFP.esc(b.category_name)}</strong><div class="muted">${MFP.money(spent)} of ${MFP.money(b.monthly_limit)}</div></div><div class="budget-bar"><span style="width:${pct}%"></span></div><button class="menu-dot budget-delete" data-id="${MFP.esc(b.id)}" aria-label="Delete budget">${icon('trash')}</button></div>`;
        }).join('');
        MFP.$$('.budget-delete').forEach(btn => btn.addEventListener('click', async () => {
          if (!MFP.confirmAction('Delete this budget?')) return;
          const { error } = await sb.from('budgets').delete().eq('id', btn.dataset.id).eq('user_id', uid);
          if (error) return MFP.toast('Could not delete budget.', 'error');
          await load();
        }));
      };
      form?.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(form), category = String(fd.get('category_name') || ''), limit = MFP.num(fd.get('monthly_limit'));
        if (!category || limit <= 0) return MFP.toast('Choose a category and enter a positive limit.', 'error');
        const { error } = await sb.from('budgets').upsert({ user_id: uid, category_name: category, monthly_limit: limit, month_start: month }, { onConflict: 'user_id,category_name,month_start' });
        if (error) return MFP.toast(error.message, 'error');
        form.reset();
        await load();
        MFP.toast('Budget saved.', 'success');
      });
      await load();
    }

    async function goalsPage() {
      const form = MFP.$('#goal-form');
      const list = MFP.$('#goal-list');
      const load = async () => {
        const { data, error } = await sb.from('savings_goals').select('*').eq('user_id', uid).order('created_at', { ascending: false });
        if (error) throw error;
        const rows = data || [];
        list.innerHTML = rows.length ? rows.map(g => {
          const pct = Math.min(100, g.target_amount ? g.current_amount / g.target_amount * 100 : 0);
          return `<div class="card goal-row"><div class="goal-top"><div><strong>${MFP.esc(g.name)}</strong><div class="muted">${MFP.money(g.current_amount)} of ${MFP.money(g.target_amount)}</div></div><button class="menu-dot goal-delete" data-id="${MFP.esc(g.id)}" aria-label="Delete goal">${icon('trash')}</button></div><div class="progress"><span style="width:${pct}%"></span></div><div class="goal-actions"><small>${pct.toFixed(0)}% complete${g.target_date ? ` • target ${MFP.esc(g.target_date)}` : ''}</small><button class="secondary-btn goal-add" data-id="${MFP.esc(g.id)}" type="button">＋ Add savings</button></div></div>`;
        }).join('') : '<div class="empty">No savings goals yet.</div>';
        MFP.$$('.goal-delete').forEach(btn => btn.addEventListener('click', async () => {
          if (!MFP.confirmAction('Delete this savings goal?')) return;
          const { error } = await sb.from('savings_goals').delete().eq('id', btn.dataset.id).eq('user_id', uid);
          if (error) return MFP.toast('Could not delete goal.', 'error');
          await load();
        }));
        MFP.$$('.goal-add').forEach(btn => btn.addEventListener('click', async () => {
          const amount = MFP.num(window.prompt('How much did you save toward this goal?', '500'));
          if (amount <= 0) return;
          const { error } = await sb.rpc('add_savings_to_goal', { p_goal_id: btn.dataset.id, p_amount: amount });
          if (error) return MFP.toast('Could not update goal.', 'error');
          await load();
        }));
      };
      form?.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(form), name = String(fd.get('name') || '').trim(), target = MFP.num(fd.get('target_amount'));
        if (!name || target <= 0) return MFP.toast('Enter a goal name and target amount.', 'error');
        const { error } = await sb.from('savings_goals').insert({ user_id: uid, name, target_amount: target, current_amount: 0, target_date: fd.get('target_date') || null });
        if (error) return MFP.toast(error.message, 'error');
        form.reset();
        await load();
        MFP.toast('Savings goal created.', 'success');
      });
      await load();
    }

    async function settingsPage() {
      const regional = MFP.$('#settings-regional');
      const notifications = MFP.$('#settings-notifications');
      if (!regional || !notifications) return;
      const { data: pref } = await sb.from('user_preferences').select('theme,timezone,currency,daily_reminder_enabled,salary_notifications_enabled,budget_notifications_enabled').eq('user_id', uid).maybeSingle();
      const timezones = ['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Europe/London','Europe/Paris','America/New_York','America/Chicago','America/Los_Angeles','Australia/Sydney','UTC'];
      const tz = MFP.$('#settings-timezone');
      tz.innerHTML = [...new Set([pref?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, ...timezones])].map(x => `<option value="${MFP.esc(x)}">${MFP.esc(x)}</option>`).join('');
      MFP.$('#settings-currency').value = pref?.currency || 'INR';
      tz.value = pref?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      notifications.daily_reminder_enabled.checked = pref?.daily_reminder_enabled ?? true;
      notifications.salary_notifications_enabled.checked = pref?.salary_notifications_enabled ?? true;
      notifications.budget_notifications_enabled.checked = pref?.budget_notifications_enabled ?? true;

      const syncTheme = () => {
        const active = document.documentElement.dataset.theme || 'dark';
        MFP.$$('[data-theme-choice]').forEach(btn => btn.classList.toggle('active', btn.dataset.themeChoice === active));
      };
      MFP.$$('[data-theme-choice]').forEach(btn => btn.addEventListener('click', () => { document.documentElement.dataset.theme = btn.dataset.themeChoice; localStorage.setItem('mfp-theme', btn.dataset.themeChoice); document.dispatchEvent(new Event('themechange')); syncTheme(); }));
      syncTheme();

      regional.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = regional.querySelector('button');
        MFP.setLoading(btn, true, 'Saving...');
        const { error } = await sb.from('user_preferences').upsert({ user_id: uid, currency: MFP.$('#settings-currency').value, timezone: tz.value }, { onConflict: 'user_id' });
        MFP.setLoading(btn, false);
        if (error) return MFP.toast('Could not save regional settings.', 'error');
        MFP.setCurrency(MFP.$('#settings-currency').value);
        MFP.toast('Regional settings saved.', 'success');
      });

      notifications.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = notifications.querySelector('button');
        MFP.setLoading(btn, true, 'Saving...');
        const { error } = await sb.from('user_preferences').upsert({ user_id: uid, daily_reminder_enabled: notifications.daily_reminder_enabled.checked, salary_notifications_enabled: notifications.salary_notifications_enabled.checked, budget_notifications_enabled: notifications.budget_notifications_enabled.checked }, { onConflict: 'user_id' });
        MFP.setLoading(btn, false);
        if (error) return MFP.toast('Could not save reminder settings.', 'error');
        MFP.toast('Reminder settings saved.', 'success');
      });
    }

    async function profilePage() {
      const form = MFP.$('#profile-form');
      if (!form) return;
      const isOnboarding = new URLSearchParams(location.search).get('onboarding') === '1';
      if (isOnboarding) {
        const note = MFP.$('#onboarding-note');
        if (note) note.style.display = 'block';
      }
      MFP.$('[name=full_name]', form).value = profile.full_name || '';
      MFP.$('[name=email]', form).value = session.user.email || '';
      MFP.$('[name=phone]', form).value = profile.phone || '';
      if (profile.gender) {
        const genderInput = MFP.$(`[name=gender][value="${profile.gender}"]`, form);
        if (genderInput) genderInput.checked = true;
      }
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(form), name = String(fd.get('full_name') || '').trim(), phone = String(fd.get('phone') || '').trim() || null, gender = fd.get('gender') || null;
        if (!name) return MFP.toast('Name is required.', 'error');
        if (!phone) return MFP.toast('Phone number is required.', 'error');
        if (!gender) return MFP.toast('Please choose your gender.', 'error');
        const { error } = await sb.from('profiles').update({ full_name: name, phone, gender }).eq('user_id', uid);
        if (error) return MFP.toast('Could not update profile.', 'error');
        await sb.auth.updateUser({ data: { full_name: name, phone, gender } });
        MFP.toast('Profile updated.', 'success');
        if (isOnboarding) { setTimeout(() => location.replace('dashboard.html'), 400); return; }
      });
      MFP.$('#change-password')?.addEventListener('click', async () => {
        const password = window.prompt('Enter your new password (8+ characters, upper/lowercase, number and symbol).');
        if (!password || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/.test(password)) return MFP.toast('Password does not meet the security requirements.', 'error');
        const { error } = await sb.auth.updateUser({ password });
        if (error) return MFP.toast(error.message, 'error');
        MFP.toast('Password changed.', 'success');
      });

      const currencyForm = MFP.$('#currency-form');
      if (currencyForm) {
        const { data: cp } = await sb.from('user_preferences').select('currency').eq('user_id', uid).maybeSingle();
        MFP.$('[name=currency]', currencyForm).value = cp?.currency || 'INR';
        currencyForm.addEventListener('submit', async e => {
          e.preventDefault();
          const code = MFP.$('[name=currency]', currencyForm).value;
          const { error } = await sb.from('user_preferences').update({ currency: code }).eq('user_id', uid);
          if (error) return MFP.toast('Could not save currency preference.', 'error');
          MFP.setCurrency(code);
          MFP.toast('Currency updated. Reloading to apply everywhere...', 'success');
          setTimeout(() => location.reload(), 600);
        });
      }

      MFP.$('#delete-account')?.addEventListener('click', async () => {
        const typed = window.prompt('This permanently deletes your account and all data. Type DELETE to confirm.');
        if (typed !== 'DELETE') { if (typed !== null) MFP.toast('Account deletion cancelled.', 'info'); return; }
        const btn = MFP.$('#delete-account');
        MFP.setLoading(btn, true, 'Deleting...');
        try {
          const { data: { session: freshSession } } = await sb.auth.getSession();
          const token = freshSession?.access_token;
          if (!token) throw new Error('Your session expired. Please log in again and retry.');
          const res = await fetch('/api/account/delete', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || 'Could not delete your account.');
          await sb.auth.signOut();
          MFP.toast('Your account has been deleted.', 'success');
          setTimeout(() => location.replace('login.html'), 600);
        } catch (err) {
          console.error(err);
          MFP.toast(err.message || 'Could not delete your account.', 'error');
        } finally { MFP.setLoading(btn, false); }
      });
    }

    async function transactionsPage() {
      const list = MFP.$('#all-transactions');
      const rows = await fetchAll('expenses', { order: ['expense_date', false] });
      const render = data => list.innerHTML = data.length ? data.map(r => `<div class="transaction"><div class="trans-icon expense-icon">${icon('receipt')}</div><div><div class="name">${MFP.esc(r.description || r.category_name)}</div><div class="desc">${MFP.esc(r.category_name)} • ${MFP.esc(r.expense_date)}</div></div><div class="amount red">${MFP.money(r.amount)}</div><a class="menu-dot" href="expense-details.html?id=${encodeURIComponent(r.id)}" aria-label="Open transaction">${icon('arrow')}</a></div>`).join('') : `<div class="empty">${rows.length ? 'No transactions match your search.' : 'No transactions recorded yet.'}</div>`;
      render(rows);
      MFP.$('#transactions-search')?.addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        render(!q ? rows : rows.filter(r => (r.description || '').toLowerCase().includes(q) || (r.category_name || '').toLowerCase().includes(q)));
      });
    }

    async function exportPage() {
      const rows = await fetchAll('expenses', { order: ['expense_date', false] });
      const incomesRows = await fetchAll('monthly_income', { order: ['income_date', false] });
      MFP.$('#export-csv')?.addEventListener('click', () => {
        const lines = [['Type', 'Date', 'Category/Source', 'Amount', 'Description', 'Payment Method'], ...rows.map(r => ['Expense', r.expense_date, r.category_name, r.amount, r.description || '', r.payment_method || '']), ...incomesRows.map(r => ['Income', r.income_date, r.source, r.amount, r.description || '', r.payment_method || ''])];
        const csvCell = value => {
          const str = String(value ?? '');
          const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
          return `"${safe.replace(/"/g, '""')}"`;
        };
        const csv = lines.map(row => row.map(csvCell).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = `my-finance-pro-${MFP.localDate()}.csv`; a.click(); URL.revokeObjectURL(url);
      });
      MFP.$('#export-pdf')?.addEventListener('click', () => window.print());
    }

    async function rent() {
      // Rent lives under Bills & Utilities → Rent in the new taxonomy, not
      // its own top-level category, so filter on both fields.
      const { data, error } = await sb.from('expenses').select('*').eq('user_id', uid).eq('category_name', 'Bills & Utilities').eq('subcategory', 'Rent').order('expense_date', { ascending: false }).limit(100);
      if (error) throw error;
      const rows = data || [];
      const monthRows = rows.filter(r => MFP.monthKey(r.expense_date) === MFP.monthKey());
      MFP.$('#rent-total').textContent = MFP.money(MFP.sum(monthRows));
      MFP.$('#rent-list').innerHTML = rows.length ? rows.slice(0, 8).map(r => `<div class="transaction"><div class="trans-icon rent-icon">${icon('rent')}</div><div><div class="name">${MFP.esc(r.description || 'Room Rent')}</div><div class="desc">${MFP.esc(r.expense_date)}</div></div><div class="amount purple">${MFP.money(r.amount)}</div><a class="menu-dot" href="expense-details.html?id=${encodeURIComponent(r.id)}" aria-label="Open rent expense">${icon('arrow')}</a></div>`).join('') : '<div class="empty">No room expenses recorded.</div>';
      const rentHref = `add-expense.html?category=${encodeURIComponent('Bills & Utilities')}&subcategory=${encodeURIComponent('Rent')}`;
      MFP.$('#rent-add')?.addEventListener('click', () => location.assign(rentHref));
      MFP.$('#rent-quick-add')?.addEventListener('click', () => location.assign(rentHref));
    }

    if (page === 'dashboard') await dashboard();
    if (page === 'income') await incomePage();
    if (page === 'expenses') await expensePage();
    if (page === 'add-income') await formPage('income');
    if (page === 'add-expense') await formPage('expense');
    if (page === 'custom-expense') await formPage('custom-expense');
    if (page === 'daily-details') await dailyPage();
    if (page === 'expense-details') await detailPage();
    if (page === 'reports') await reports();
    if (page === 'salary-settings') await salarySettingsPage();
    if (page === 'notifications') await notificationsPage();
    if (page === 'grocery') await grocery();
    if (page === 'rent') await rent();
    if (page === 'categories') await categoriesPage();
    if (page === 'quick-add') await quickAddPage();
    if (page === 'expense-category') await expenseCategoryPage();
    if (page === 'recurring') await recurringPage();
    if (page === 'budgets') await budgetsPage();
    if (page === 'savings-goals') await goalsPage();
    if (page === 'settings') await settingsPage();
    if (page === 'profile') await profilePage();
    if (page === 'transactions') await transactionsPage();
    if (page === 'export') await exportPage();
  } catch (err) {
    console.error('Finora runtime error', err);
    document.querySelectorAll('.empty').forEach(el => {
      if (el.classList.contains('state-loading') || /Loading|Checking/.test(el.textContent || '')) {
        el.classList.remove('state-loading');
        el.classList.add('state-error');
        el.innerHTML = `<div class="state-icon">${icon('info')}</div><strong>We couldn't load this section</strong><span class="muted">${navigator.onLine ? 'Please refresh and try again.' : 'Reconnect to the internet and try again.'}</span><button type="button" class="retry-btn">${icon('refresh')} Retry</button>`;
        el.querySelector('.retry-btn')?.addEventListener('click', () => location.reload());
      }
    });
    MFP.toast(navigator.onLine ? 'Something went wrong. Please refresh and try again.' : 'You are offline. Reconnect and try again.', 'error');
  }
})();
