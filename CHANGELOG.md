## 0.0.4 — Production Hardening
- Fixed all existing categoryIcon unit-test regressions.
- Added a dedicated Settings screen for theme, currency, timezone and reminder controls.
- Added production cache policies and extra security headers.
- Added a production security runbook and explicit deployment hardening checklist.
- Updated service-worker shell cache to v7.

## 0.0.3 — Expense Category System
- Added 11 group-wise expense categories with dedicated icons.
- Added 60+ daily expense types covering connectivity, utilities, food, transport, shopping, health, entertainment, travel, personal care, education/work, finance, and family.
- Updated Home Quick Add with Grocery, Bus, Cab, Bike, Other Expenses, Food Delivery, and Shopping while keeping Income and Room Rent.
- Added grouped Quick Add search and + action.
- Added dynamic dedicated expense pages: `expense-category.html?category=...`.
- Preserved existing expense form, subcategory support, income flow, and Room Rent flow.
- Bumped service-worker shell cache to v6.

# Changelog

All notable changes to Finora are documented here. This file, `package.json`'s
`version`, `version.json`, and `js/update.js`'s `CURRENT_VERSION` should always
move together — see `AUDIT_REPORT.md` §3 for the release checklist.

## 1.1.0 — 2026-08-13
### Added
- In-app **Check for Updates** screen (More → App) with changelog display and one-tap install via the service worker.
- `robots.txt` and `.well-known/security.txt` (responsible disclosure).
- `scripts/generate-sri.js` — generates real Subresource Integrity hashes for the CDN-loaded Supabase/Chart.js scripts.
### Fixed
- `Content-Security-Policy` `style-src` now allows the inline styles the app relies on for dynamic bars/colors/charts (previously would have been blocked by a strictly enforcing browser).
- `/version.json` is now excluded from CDN edge caching, not just the service worker's cache, so update checks always see the true latest version.
### Changed
- Service worker no longer activates a new version silently on every deploy — it now waits for explicit user confirmation through the update screen.

## 1.0.0
- Initial production release: expense/income tracking, budgets, savings goals, recurring expenses, reports, grocery & rent tracking, PWA support.
