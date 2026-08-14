create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default 'User',
  phone text,
  gender text check (gender in ('male', 'female')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR' check (currency in ('INR','USD','EUR','GBP','AUD','CAD','SGD','AED')),
  daily_reminder_enabled boolean not null default true,
  salary_notifications_enabled boolean not null default true,
  budget_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  monthly_salary numeric(14,2) not null check (monthly_salary >= 0),
  salary_day smallint not null check (salary_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  source text not null,
  income_date date not null,
  description text,
  payment_method text,
  is_salary boolean not null default false,
  salary_month date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, salary_month)
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_name text not null,
  subcategory text,
  amount numeric(14,2) not null check (amount > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  payment_method text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  category_name text not null,
  subcategory text,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null,
  description text,
  notes text,
  payment_method text,
  receipt_path text,
  recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','daily_detail','recurring')) ,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  quantity numeric(12,3) check (quantity is null or quantity >= 0),
  unit text,
  price numeric(14,2) not null check (price > 0),
  item_date date not null,
  notes text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  travel_type text not null check (travel_type in ('Bus Travel','Cab Travel','Online Travel')),
  amount numeric(14,2) not null check (amount > 0),
  travel_date date not null,
  description text,
  source_platform text,
  notes text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_type text not null check (expense_type in ('Rent','Electricity','Water','Maintenance','Other')),
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null,
  description text,
  notes text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status_date date not null,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, status_date)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, dedupe_key)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  category_name text not null,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  month_start date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, category_name, month_start)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses(user_id, expense_date desc);
create unique index if not exists expenses_recurring_date_unique_idx on public.expenses(recurring_expense_id, expense_date) where recurring_expense_id is not null;

create index if not exists expenses_user_category_idx on public.expenses(user_id, category_name, expense_date desc);
create index if not exists income_user_date_idx on public.monthly_income(user_id, income_date desc);
create index if not exists grocery_user_date_idx on public.grocery_items(user_id, item_date desc);
create index if not exists travel_user_date_idx on public.travel_expenses(user_id, travel_date desc);
create index if not exists room_user_date_idx on public.room_expenses(user_id, expense_date desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists daily_status_user_date_idx on public.daily_status(user_id, status_date desc);
create index if not exists budgets_user_month_idx on public.budgets(user_id, month_start, category_name);
create index if not exists savings_goals_user_idx on public.savings_goals(user_id, created_at desc);
