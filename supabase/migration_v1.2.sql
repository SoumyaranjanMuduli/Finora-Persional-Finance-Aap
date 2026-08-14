-- Migration v1.2: custom categories are already supported by the existing schema
-- (expense_categories has always allowed per-user inserts). This migration adds:
--   1. user_preferences.currency (multi-currency preference)
--   2. recurring_expenses table + expenses.recurring_expense_id link
--   3. generate_recurring_expenses_for_month() RPC
--   4. RLS policies + updated_at trigger for the new table
--
-- Safe to run once on an existing project that already has schema.sql,
-- functions.sql and policies.sql applied. Re-running schema.sql/functions.sql/
-- policies.sql from a fresh v1.2 copy also works, but this file is faster and
-- does not touch data in tables that already exist.

alter table public.user_preferences
  add column if not exists currency text not null default 'INR'
    check (currency in ('INR','USD','EUR','GBP','AUD','CAD','SGD','AED'));

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

alter table public.expenses
  add column if not exists recurring_expense_id uuid references public.recurring_expenses(id) on delete set null;

alter table public.recurring_expenses enable row level security;

drop policy if exists "Users can select own recurring_expenses" on public.recurring_expenses;
create policy "Users can select own recurring_expenses" on public.recurring_expenses for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own recurring_expenses" on public.recurring_expenses;
create policy "Users can insert own recurring_expenses" on public.recurring_expenses for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own recurring_expenses" on public.recurring_expenses;
create policy "Users can update own recurring_expenses" on public.recurring_expenses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own recurring_expenses" on public.recurring_expenses;
create policy "Users can delete own recurring_expenses" on public.recurring_expenses for delete using (auth.uid() = user_id);

drop trigger if exists touch_recurring_expenses on public.recurring_expenses;
create trigger touch_recurring_expenses before update on public.recurring_expenses for each row execute function public.touch_updated_at();

create or replace function public.generate_recurring_expenses_for_month(p_month date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := current_date;
  v_last_day int;
  v_row public.recurring_expenses%rowtype;
  v_due_date date;
  v_created int := 0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if date_trunc('month', p_month)::date <> p_month then
    raise exception 'p_month must be the first day of a month';
  end if;

  v_last_day := extract(day from (p_month + interval '1 month - 1 day'))::int;

  for v_row in
    select * from public.recurring_expenses
    where user_id = v_user and active = true
  loop
    v_due_date := p_month + (least(v_row.day_of_month, v_last_day) - 1);
    if v_due_date > v_today then continue; end if;

    if not exists (
      select 1 from public.expenses
      where recurring_expense_id = v_row.id
        and expense_date >= p_month
        and expense_date <= (p_month + interval '1 month - 1 day')::date
    ) then
      insert into public.expenses(
        user_id, category_name, subcategory, amount, expense_date,
        description, payment_method, notes, recurring_expense_id
      ) values (
        v_user, v_row.category_name, v_row.subcategory, v_row.amount, v_due_date,
        v_row.category_name || ' (auto)', v_row.payment_method, v_row.notes, v_row.id
      );
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;
