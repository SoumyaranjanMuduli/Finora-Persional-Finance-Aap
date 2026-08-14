window.MFP = (() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const currencyLocales = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', AUD: 'en-AU', CAD: 'en-CA', SGD: 'en-SG', AED: 'ar-AE' };
  let activeCurrency = localStorage.getItem('mfp-currency') || 'INR';
  const setCurrency = code => {
    if (!currencyLocales[code]) return;
    activeCurrency = code;
    localStorage.setItem('mfp-currency', code);
  };
  const money = n => new Intl.NumberFormat(currencyLocales[activeCurrency] || 'en-IN', { style: 'currency', currency: activeCurrency, maximumFractionDigits: 2 }).format(Number(n) || 0);
  const num = v => Number.parseFloat(v) || 0;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const localDate = d => { const x = d ? new Date(d) : new Date(); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const monthStart = d => { const x = d ? new Date(d) : new Date(); return new Date(x.getFullYear(), x.getMonth(), 1); };
  const monthEnd = d => { const x = d ? new Date(d) : new Date(); return new Date(x.getFullYear(), x.getMonth()+1, 0, 23, 59, 59, 999); };
  const monthKey = d => { const x = d ? new Date(d) : new Date(); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; };
  const monthLabel = key => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-IN', { month:'long', year:'numeric' });
  const toast = (msg, type='info') => { const el=document.createElement('div'); el.className=`toast toast-${type}`; el.textContent=msg; document.body.appendChild(el); requestAnimationFrame(()=>el.classList.add('show')); setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),250)},3000); };
  const confirmAction = msg => window.confirm(msg);

  // 12 main categories x subcategories. category_name on an expense row is
  // always one of the 12 group names below; subcategory is the specific item
  // ('Transport' / 'Bus'), not a free-text field anymore.
  const expenseGroups = [
    {
      name: 'Mobile & Connectivity',
      icon: 'phone',
      description: 'Mobile, internet, TV and connectivity bills',
      items: [
        ['Mobile Recharge', 'phone'], ['Wi-Fi', 'wifi'], ['DTH', 'tv'], ['OTT', 'ott'],
        ['Broadband', 'wifi'], ['Data Pack', 'recharge'], ['Postpaid Bill', 'receipt'], ['Landline', 'phone']
      ]
    },
    {
      name: 'Food & Groceries',
      icon: 'cart',
      description: 'Daily food, grocery and dining expenses',
      items: [
        ['Groceries', 'cart'], ['Dining', 'utensils'], ['Food Delivery', 'food'],
        ['Fruits', 'apple'], ['Vegetables', 'apple'], ['Milk', 'milk'],
        ['Snacks', 'snack'], ['Bakery', 'snack'], ['Meat & Seafood', 'cart']
      ]
    },
    {
      name: 'Transport',
      icon: 'bus',
      description: 'Everyday commuting and vehicle expenses',
      items: [
        ['Bus', 'bus'], ['Cab', 'car'], ['Bike', 'bike'], ['Auto', 'auto'],
        ['Fuel', 'fuel'], ['Train', 'train'], ['Metro', 'train'], ['Flight', 'plane'],
        ['Parking', 'parking'], ['Toll', 'toll'], ['Vehicle Service', 'car']
      ]
    },
    {
      name: 'Shopping',
      icon: 'shopping',
      description: 'Personal, online and household shopping',
      items: [
        ['Clothing', 'shirt'], ['Shoes', 'shoe'], ['Electronics', 'device'],
        ['Online Shopping', 'shopping'], ['Gifts', 'gift'], ['Accessories', 'gift'],
        ['Home & Kitchen', 'shopping'], ['Appliances', 'device']
      ]
    },
    {
      name: 'Bills & Utilities',
      icon: 'receipt',
      description: 'Recurring household bills and services',
      items: [
        ['Electricity', 'bolt'], ['Water', 'water'], ['Gas', 'flame'], ['Rent', 'rent'],
        ['Domestic Help', 'user'], ['Maintenance', 'receipt'], ['Internet', 'wifi'], ['Society / HOA', 'receipt']
      ]
    },
    {
      name: 'Health & Fitness',
      icon: 'shield',
      description: 'Healthcare, medicine and fitness',
      items: [
        ['Medicine', 'medicine'], ['Doctor', 'doctor'], ['Hospital', 'hospital'], ['Gym', 'gym'],
        ['Dental', 'dental'], ['Diagnostics', 'hospital'], ['Therapy', 'doctor'], ['Fitness', 'gym']
      ]
    },
    {
      name: 'Entertainment & Subscriptions',
      icon: 'movie',
      description: 'Streaming, music, games and leisure',
      items: [
        ['OTT', 'ott'], ['Music', 'music'], ['Gaming', 'gaming'], ['Movies', 'movie'],
        ['Events', 'event'], ['Subscriptions', 'ott'], ['Books', 'book']
      ]
    },
    {
      name: 'Travel',
      icon: 'plane',
      description: 'Trips, stays and travel bookings',
      items: [
        ['Hotel', 'hotel'], ['Flights', 'plane'], ['Tickets', 'ticket'], ['Local Travel', 'car'],
        ['Vacation', 'palm'], ['Visa', 'plane'], ['Travel Insurance', 'insurance'], ['Activities', 'ticket']
      ]
    },
    {
      name: 'Personal Care',
      icon: 'user',
      description: 'Grooming and personal wellness',
      items: [
        ['Salon', 'salon'], ['Cosmetics', 'cosmetic'], ['Haircut', 'hair'],
        ['Grooming', 'groom'], ['Spa', 'salon'], ['Skincare', 'cosmetic']
      ]
    },
    {
      name: 'Education & Work',
      icon: 'book',
      description: 'Learning, office and professional expenses',
      items: [
        ['Courses', 'book'], ['Books', 'book'], ['Stationery', 'stationery'], ['Software', 'software'],
        ['Work Expenses', 'briefcase'], ['Office Supplies', 'stationery'], ['Certifications', 'book'], ['Training', 'briefcase']
      ]
    },
    {
      name: 'Finance',
      icon: 'wallet',
      description: 'Loans, banking and financial commitments',
      items: [
        ['EMI', 'emi'], ['Insurance', 'insurance'], ['Bank Charges', 'bank'], ['Credit Card', 'card'],
        ['Investment', 'investment'], ['Loan Repayment', 'emi'], ['Taxes', 'bank'], ['Fees', 'card']
      ]
    },
    {
      name: 'Family & Others',
      icon: 'users',
      description: 'Family, pets, donations and miscellaneous spending',
      items: [
        ['Family', 'users'], ['Child', 'child'], ['Pet', 'pet'],
        ['Donations', 'donation'], ['Events', 'event'], ['Other', 'more']
      ]
    }
  ];

  // category_name is always a main group name now (Transport, Food & Groceries, ...).
  // 'Other Spend' stays as the catch-all for anything that doesn't fit.
  const defaultCategories = [...expenseGroups.map(g => g.name), 'Other Spend'];
  const groupByName = name => expenseGroups.find(g => g.name.toLowerCase() === String(name || '').toLowerCase());
  const subcategoriesFor = groupName => groupByName(groupName)?.items || [];
  const categoryIcon = name => {
    const map = {
      'Mobile & Connectivity':'phone', 'Food & Groceries':'cart', Transport:'bus',
      'Bills & Utilities':'receipt', 'Health & Fitness':'shield',
      'Entertainment & Subscriptions':'movie', 'Personal Care':'user',
      'Education & Work':'book', Finance:'wallet', 'Family & Others':'users',
      Groceries:'cart', Grocery:'cart', 'Food & Dining':'utensils', Dining:'utensils',
      'Food Delivery':'food', Fruits:'apple', Milk:'milk', Snacks:'snack',
      Bus:'bus', 'Bus Travel':'bus', Cab:'car', 'Cab Travel':'car', Bike:'bike',
      Auto:'auto', Fuel:'fuel', Train:'train', Flight:'plane', Flights:'plane',
      Parking:'parking', Toll:'toll', 'Local Travel':'car',
      Shopping:'shopping', Clothing:'shirt', Shoes:'shoe', Electronics:'device',
      'Online Shopping':'shopping', Gifts:'gift',
      'Mobile Recharge':'phone', Recharge:'recharge', DTH:'tv', 'Wi-Fi':'wifi',
      Electricity:'bolt', Water:'water', Gas:'flame', Rent:'rent', 'Room Rent':'rent',
      'Domestic Help':'user', 'Bills & Utilities':'receipt',
      Medicine:'medicine', Doctor:'doctor', Hospital:'hospital', Gym:'gym', Dental:'dental',
      'Health & Fitness':'shield', OTT:'ott', Music:'music', Gaming:'gaming',
      Movies:'movie', Movie:'movie', Entertainment:'movie',
      Hotel:'hotel', Tickets:'ticket', Vacation:'palm', Salon:'salon',
      Cosmetics:'cosmetic', Haircut:'hair', Grooming:'groom',
      Courses:'book', Books:'book', Stationery:'stationery', Software:'software',
      'Work Expenses':'briefcase', EMI:'emi', Insurance:'insurance',
      'Bank Charges':'bank', 'Credit Card':'card', Investment:'investment',
      Family:'users', Child:'child', Pet:'pet', Donations:'donation',
      Events:'event', Other:'more', 'Other Spend':'more'
    };
    if (map[name]) return map[name];
    const lower = String(name || '').toLowerCase();
    if (lower.includes('recharge') || lower.includes('mobile')) return 'phone';
    if (lower.includes('wifi') || lower.includes('wi-fi')) return 'wifi';
    if (lower.includes('dth') || lower.includes('tv')) return 'tv';
    if (lower.includes('bus')) return 'bus';
    if (lower.includes('cab') || lower.includes('taxi')) return 'car';
    if (lower.includes('bike')) return 'bike';
    if (lower.includes('flight') || lower.includes('travel') || lower.includes('plane')) return 'plane';
    if (lower.includes('rent')) return 'rent';
    if (lower.includes('grocery') || lower.includes('food') || lower.includes('dining') || lower.includes('restaurant')) return 'cart';
    if (lower.includes('shop')) return 'shopping';
    if (lower.includes('movie') || lower.includes('ott')) return 'movie';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('doctor')) return 'shield';
    if (lower.includes('bill') || lower.includes('utilit')) return 'receipt';
    return 'tag';
  };

  const sum = (rows,key='amount') => rows.reduce((a,r)=>a+num(r[key]),0);
  const setLoading = (el,loading,label) => { if(!el)return; el.disabled=loading; if(loading){el.dataset.label=el.textContent;el.innerHTML=`<span class="spinner"></span>${label||'Saving...'}`}else if(el.dataset.label){el.textContent=el.dataset.label} };
  const icon = (name, cls='') => {
    const p={
      home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',wallet:'<path d="M4 6h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"/><path d="M2 8h17M16 13h3"/>',receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>',filter:'<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',logout:'<path d="M10 17l5-5-5-5M15 12H3M13 4h6v16h-6"/>',edit:'<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',back:'<path d="M19 12H5M11 18l-6-6 6-6"/>',check:'<path d="m5 12 4 4L19 6"/>',lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',phone:'<path d="M6 3h3l2 5-2 2a15 15 0 0 0 5 5l2-2 5 2v3c0 1-1 2-2 2C10 20 4 14 3 5c0-1 1-2 3-2Z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m17 7 4-4M18 3h3v3"/>',shopping:'<path d="M4 7h16l-1 13H5L4 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/>',bus:'<path d="M5 17V7c0-3 3-4 7-4s7 1 7 4v10M5 13h14M8 18v2M16 18v2M7 17h2M15 17h2"/>',car:'<path d="m5 11 2-5h10l2 5M3 11h18v6H3zM7 17v2M17 17v2M6 14h.01M18 14h.01"/>',plane:'<path d="m3 11 18-7-7 18-3-7-8-4Z"/><path d="M11 15 7 21"/>',rent:'<path d="m3 11 9-8 9 8v9H3v-9Z"/><path d="M9 20v-6h6v6"/>',cart:'<path d="M3 4h2l2 12h11l2-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',tag:'<path d="M3 3h7l11 11-7 7L3 10V3Z"/><circle cx="7" cy="7" r="1"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',save:'<path d="M5 3h12l3 3v15H4V3h12"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',shield:'<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',refresh:'<path d="M20 11a8 8 0 0 0-14.5-4L3 10M4 4v6h6M4 13a8 8 0 0 0 14.5 4L21 14M20 20v-6h-6"/>',
      piggy:'<path d="M19 9V7a2 2 0 0 0-2-2h-1.1a5 5 0 0 0-9.5 1H5a2 2 0 0 0-2 2c0 1.5 1 2 1 3v4c0 1 .7 1.7 1.7 2H7v2h3v-2h4v2h3v-2.2c1-.5 2-1.4 2-2.8v-1"/><circle cx="15.5" cy="11.5" r="1"/><path d="M6 10 3.5 8"/>',
      percent:'<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M18 6 6 18"/>',
      trending:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
      compare:'<path d="M8 3v14M8 17l-4-4M8 17l4-4M16 21V7M16 7l-4 4M16 7l4 4"/>',
      list:'<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/>',
      send:'<path d="m3 11 18-8-8 18-2-8-8-2Z"/>',
      apple:'<path d="M16.5 12.3c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.5-1.7-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.3 2-1.4 2.5-.4 6.1 1 8.1.7 1 1.5 2.1 2.6 2 1-.1 1.4-.7 2.7-.7 1.3 0 1.6.7 2.7.7 1.1 0 1.9-1 2.6-2 .6-.9.9-1.7 1.1-2.2-2.9-1.1-2.4-4.1-2.4-4.1Z" fill="currentColor" stroke="none"/><path d="M14.5 5.5c.5-.6.9-1.5.8-2.4-.8.1-1.8.6-2.3 1.2-.5.5-1 1.4-.8 2.3.9.1 1.8-.5 2.3-1.1Z" fill="currentColor" stroke="none"/>',
      close:'<path d="M6 6l12 12M18 6 6 18"/>',
      movie:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="m3 9 3-3M8.5 9l3-3M14 9l3-3M19 9l1-1"/><path d="M9.5 11.5v4l4-2Z"/>',
      recharge:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10.5 8 9 13h3l-1.5 5 4-6h-3l1.5-4Z"/>'
    };
    if (name === 'google') {
      return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z"/></svg>`;
    }
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.more}</svg>`;
  };
  return { $, $$, money, setCurrency, num, esc, localDate, monthStart, monthEnd, monthKey, monthLabel, toast, confirmAction, sum, setLoading, icon, defaultCategories, categoryIcon, expenseGroups, groupByName, subcategoriesFor };
})();

// Replace any static [data-icon="name"] placeholders in the markup with the
// matching premium SVG icon. Runs immediately since utils.js is loaded at the
// end of <body>, after the DOM it needs to touch already exists.
(() => {
  const nodes = document.querySelectorAll('[data-icon]');
  nodes.forEach(el => {
    const name = el.getAttribute('data-icon');
    el.innerHTML = window.MFP.icon(name);
  });
})();
