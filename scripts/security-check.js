const fs = require('fs');
const schema = fs.readFileSync('supabase/schema.sql', 'utf8');
const policies = fs.readFileSync('supabase/policies.sql', 'utf8');
const functions = fs.readFileSync('supabase/functions.sql', 'utf8');
const browserFiles = fs.readdirSync('js').filter(f => f.endsWith('.js') && !f.endsWith('.test.js')).map(f => `js/${f}`);
const userTables = ['profiles','user_preferences','salary_settings','monthly_income','expense_categories','expenses','grocery_items','travel_expenses','room_expenses','daily_status','notifications','budgets','savings_goals','recurring_expenses'];
let failed = false;

console.log('\n🔐 Security static audit...\n');

// Verify schema has all tables
for (const table of userTables) {
  if (!new RegExp(`create table if not exists public\\.${table}`, 'i').test(schema)) {
    console.error(`❌ Missing table: ${table}`);
    failed = true;
  }
}

// Verify policies.sql has explicit CREATE POLICY statements for all tables
let policyCount = 0;
for (const table of userTables) {
  // Check RLS is enabled
  if (!new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(policies)) {
    console.error(`❌ RLS not enabled: ${table}`);
    failed = true;
  }
  
  // Check explicit CREATE POLICY statements (4 per table)
  const selectMatch = new RegExp(`create policy .* on public\\.${table}\\s+for select`, 'i').test(policies);
  const insertMatch = new RegExp(`create policy .* on public\\.${table}\\s+for insert`, 'i').test(policies);
  const updateMatch = new RegExp(`create policy .* on public\\.${table}\\s+for update`, 'i').test(policies);
  const deleteMatch = new RegExp(`create policy .* on public\\.${table}\\s+for delete`, 'i').test(policies);
  
  if (selectMatch && insertMatch && updateMatch && deleteMatch) {
    policyCount += 4;
  } else {
    if (!selectMatch) console.error(`❌ RLS SELECT policy missing: ${table}`);
    if (!insertMatch) console.error(`❌ RLS INSERT policy missing: ${table}`);
    if (!updateMatch) console.error(`❌ RLS UPDATE policy missing: ${table}`);
    if (!deleteMatch) console.error(`❌ RLS DELETE policy missing: ${table}`);
    failed = true;
  }
}

// Verify auth.uid() = user_id is the enforcement mechanism
if (!policies.includes('auth.uid() = user_id')) {
  console.error('❌ auth.uid() = user_id enforcement pattern missing in policies');
  failed = true;
}

// Verify schema contains user_id columns
if (!/user_id\s+uuid/i.test(schema)) {
  console.error('❌ user_id UUID columns missing in schema');
  failed = true;
}

// Verify storage policies (simple string check for key patterns)
if (!policies.includes("storage.foldername(name))[1]") || !policies.includes("auth.uid()::text")) {
  console.error('❌ Receipt storage ownership policy missing');
  failed = true;
}


if (!/source\s+text\s+not null default 'manual'/i.test(schema)) { console.error('❌ expenses.source marker missing'); failed = true; }
if (!/expenses_recurring_date_unique_idx/i.test(schema)) { console.error('❌ recurring expense idempotency index missing'); failed = true; }
if (!/grocery_items.*quantity.*check|quantity numeric\(12,3\) check/i.test(schema)) { console.error('❌ grocery quantity constraint missing'); failed = true; }
if (!schema.includes("color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')")) { console.error('❌ color format constraint missing'); failed = true; }
if (!/add_savings_to_goal/i.test(functions)) { console.error('❌ atomic savings RPC missing'); failed = true; }
if (!/revoke all on function public\.generate_recurring_expenses_for_month\(date\) from public/i.test(functions)) { console.error('❌ recurring SECURITY DEFINER function is not revoked from public'); failed = true; }
if (!/grant execute on function public\.generate_recurring_expenses_for_month\(date\) to authenticated/i.test(functions)) { console.error('❌ recurring RPC is not granted to authenticated'); failed = true; }

// Verify functions use SECURITY DEFINER with search_path pinned
if (/security\s+definer/i.test(functions) && !/search_path\s*=\s*''/i.test(functions)) {
  console.error('❌ Security-definer functions must use an empty search_path');
  failed = true;
}

// Verify no secrets in browser files
for (const file of browserFiles) {
  const src = fs.readFileSync(file, 'utf8');
  if (/service[_-]role|SUPABASE_SECRET_KEY|CRON_SECRET/i.test(src)) {
    console.error(`❌ Secret key reference in browser file: ${file}`);
    failed = true;
  }
}

// Verify CSV export neutralizes spreadsheet formula prefixes before quoting.
const appSrc = fs.readFileSync('js/app.js', 'utf8');
if (!/\/\^\[=\+\\-@\]\/.test\(str\)/.test(appSrc) || !/safe\.replace\(\/\"\/g, '\"\"'\)/.test(appSrc)) {
  console.error('❌ CSV export is missing formula-injection neutralization');
  failed = true;
}

// Verify cron endpoints are protected
for (const file of ['api/cron/daily-check.js','api/cron/salary-check.js','api/cron/recurring-check.js']) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Cron endpoint missing: ${file}`);
    failed = true;
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('CRON_SECRET') || !src.includes('SUPABASE_SECRET_KEY')) {
    console.error(`❌ Cron endpoint not protected: ${file}`);
    failed = true;
  }
}

// Verify account deletion endpoint
if (fs.existsSync('api/account/delete.js')) {
  const src = fs.readFileSync('api/account/delete.js', 'utf8');
  if (!src.includes('SUPABASE_SECRET_KEY')) {
    console.error('❌ Account deletion endpoint missing service-role usage');
    failed = true;
  }
  if (!/authorization/i.test(src)) {
    console.error('❌ Account deletion endpoint does not check auth token');
    failed = true;
  }
  if (!/auth\/v1\/user/i.test(src)) {
    console.error('❌ Account deletion endpoint does not verify caller token');
    failed = true;
  }
}

if (!failed) {
  console.log('✓ 14 tables defined in schema');
  console.log(`✓ ${policyCount}+ explicit CREATE POLICY statements (4+ per table)`);
  console.log('✓ auth.uid() = user_id enforcement verified');
  console.log('✓ user_id UUID columns verified');
  console.log('✓ Storage policies for receipts verified');
  console.log('✓ Security-definer functions use empty search_path');
  console.log('✓ No secrets leaked in browser code');
  console.log('✓ Cron endpoints protected');
  console.log('✓ CSV export neutralizes spreadsheet formulas');
  console.log('✓ Account deletion endpoint protected\n');
}

console.log(`Security audit: ${failed ? '❌ FAILED' : '✅ PASSED'}\n`);
if (failed) process.exit(1);
