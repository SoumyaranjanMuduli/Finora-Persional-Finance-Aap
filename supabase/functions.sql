create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','salary_settings','monthly_income','expense_categories','expenses','grocery_items','travel_expenses','room_expenses','daily_status','notifications','budgets','savings_goals','recurring_expenses'] loop
    execute format('drop trigger if exists %I on public.%I', 'touch_'||t, t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'touch_'||t, t);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,full_name,phone)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.raw_user_meta_data->>'phone')
  on conflict(user_id) do update set full_name=excluded.full_name, phone=coalesce(excluded.phone,public.profiles.phone);
  insert into public.user_preferences(user_id,timezone) values(new.id,coalesce(new.raw_user_meta_data->>'timezone','Asia/Kolkata')) on conflict(user_id) do nothing;
  insert into public.expense_categories(user_id,name,is_default,color) values
    (new.id,'Mobile & Connectivity',true,'#2588ff'),(new.id,'Food & Groceries',true,'#05d99b'),
    (new.id,'Transport',true,'#f5a623'),(new.id,'Shopping',true,'#e91e8c'),
    (new.id,'Bills & Utilities',true,'#8c4dff'),(new.id,'Health & Fitness',true,'#00a7a7'),
    (new.id,'Entertainment & Subscriptions',true,'#6b4dff'),(new.id,'Travel',true,'#0aa66e'),
    (new.id,'Personal Care',true,'#ff6f91'),(new.id,'Education & Work',true,'#3f6bff'),
    (new.id,'Finance',true,'#2ea043'),(new.id,'Family & Others',true,'#8a63d2'),
    (new.id,'Other Spend',true,'#ff4b55')
  on conflict(user_id,name) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();


-- Atomic salary generation. The authenticated user can only generate their own salary.
create or replace function public.generate_salary_for_month(p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_salary public.salary_settings%rowtype;
  v_last_day int;
  v_salary_day int;
  v_salary_date date;
  v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if pg_catalog.date_trunc('month', p_month)::date <> p_month then
    raise exception 'p_month must be the first day of a month';
  end if;

  select * into v_salary from public.salary_settings
  where user_id = v_user and active = true;
  if not found then return null; end if;

  v_last_day := pg_catalog.extract(day from (p_month + interval '1 month - 1 day'))::int;
  v_salary_day := least(v_salary.salary_day, v_last_day);
  v_salary_date := p_month + (v_salary_day - 1);

  insert into public.monthly_income(
    user_id, amount, source, income_date, description, is_salary, salary_month
  ) values (
    v_user, v_salary.monthly_salary, 'Salary', v_salary_date,
    'Monthly salary', true, p_month
  )
  on conflict (user_id, salary_month) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.monthly_income
    where user_id = v_user and salary_month = p_month;
  end if;

  return v_id;
end;
$$;

-- Generates this month's expense rows for every active recurring expense whose
-- day has arrived, once per recurring expense per month (idempotent, self-service).
create or replace function public.generate_recurring_expenses_for_month(p_month date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := current_date;
  v_last_day int;
  v_row public.recurring_expenses%rowtype;
  v_due_date date;
  v_created int := 0;
  v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if pg_catalog.date_trunc('month', p_month)::date <> p_month then
    raise exception 'p_month must be the first day of a month';
  end if;

  v_last_day := pg_catalog.extract(day from (p_month + interval '1 month - 1 day'))::int;

  for v_row in
    select * from public.recurring_expenses
    where user_id = v_user and active = true
  loop
    v_due_date := p_month + (pg_catalog.least(v_row.day_of_month, v_last_day) - 1);
    if v_due_date > v_today then continue; end if;

    insert into public.expenses(
      user_id, category_name, subcategory, amount, expense_date,
      description, payment_method, notes, recurring_expense_id, source
    ) values (
      v_user, v_row.category_name, v_row.subcategory, v_row.amount, v_due_date,
      v_row.category_name || ' (auto)', v_row.payment_method, v_row.notes, v_row.id, 'recurring'
    ) on conflict (recurring_expense_id, expense_date) do nothing
    returning id into v_id;
    if v_id is not null then v_created := v_created + 1; end if;
  end loop;

  return v_created;
end;
$$;

-- Atomic grocery insert: create the expense and item together.
create or replace function public.add_grocery_item(
  p_item_name text,
  p_quantity numeric,
  p_unit text,
  p_price numeric,
  p_date date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_category uuid;
  v_expense uuid;
  v_item uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_item_name), '') is null then raise exception 'Item name is required'; end if;
  if p_price <= 0 then raise exception 'Price must be greater than zero'; end if;
  if p_quantity is not null and p_quantity < 0 then raise exception 'Quantity cannot be negative'; end if;
  if p_date is null then raise exception 'Date is required'; end if;

  select id into v_category from public.expense_categories
  where user_id = v_user and name = 'Food & Groceries' limit 1;

  insert into public.expenses(
    user_id, category_id, category_name, subcategory, amount, expense_date, description, notes
  ) values (
    v_user, v_category, 'Food & Groceries', 'Groceries', p_price, p_date,
    trim(p_item_name), nullif(trim(p_notes), '')
  ) returning id into v_expense;

  insert into public.grocery_items(
    user_id, item_name, quantity, unit, price, item_date, notes, expense_id
  ) values (
    v_user, trim(p_item_name), p_quantity, nullif(trim(p_unit), ''), p_price, p_date,
    nullif(trim(p_notes), ''), v_expense
  ) returning id into v_item;

  return v_item;
end;
$$;

-- Save today's six-category details atomically. Existing daily rows for the same
-- user/date are replaced, while the completion marker is upserted exactly once.
create or replace function public.save_daily_details(
  p_date date,
  p_notes text,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_entry jsonb;
  v_category text;
  v_amount numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_date is null then raise exception 'Date is required'; end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'Entries must be an array'; end if;

  delete from public.expenses
  where user_id = v_user
    and expense_date = p_date
    and source = 'daily_detail';

  for v_entry in select * from jsonb_array_elements(p_entries) loop
    v_category := nullif(trim(v_entry->>'category_name'), '');
    v_amount := coalesce((v_entry->>'amount')::numeric, 0);
    if v_category is null then continue; end if;
    if v_amount < 0 then raise exception 'Amount cannot be negative'; end if;
    if v_amount = 0 then continue; end if;

    insert into public.expenses(
      user_id, category_name, amount, expense_date, description, notes, source
    ) values (
      v_user, v_category, v_amount, p_date,
      'Daily ' || v_category, nullif(trim(p_notes), ''), 'daily_detail'
    );
  end loop;

  insert into public.daily_status(user_id, status_date, completed, notes)
  values (v_user, p_date, true, nullif(trim(p_notes), ''))
  on conflict (user_id, status_date) do update
    set completed = true,
        notes = excluded.notes,
        updated_at = now();
end;
$$;


-- Atomic savings increment; prevents lost updates from concurrent tabs/requests.
create or replace function public.add_savings_to_goal(p_goal_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_current numeric;
  v_target numeric;
  v_next numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  update public.savings_goals
     set current_amount = pg_catalog.least(target_amount, current_amount + p_amount)
   where id = p_goal_id and user_id = v_user
   returning current_amount, target_amount into v_current, v_target;
  if not found then raise exception 'Savings goal not found'; end if;
  v_next := pg_catalog.least(v_target, v_current);
  return v_next;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.generate_recurring_expenses_for_month(date) from public;
grant execute on function public.generate_recurring_expenses_for_month(date) to authenticated;

revoke all on function public.generate_salary_for_month(date) from public;
grant execute on function public.generate_salary_for_month(date) to authenticated;
revoke all on function public.add_grocery_item(text,numeric,text,numeric,date,text) from public;
grant execute on function public.add_grocery_item(text,numeric,text,numeric,date,text) to authenticated;
revoke all on function public.save_daily_details(date,text,jsonb) from public;
grant execute on function public.save_daily_details(date,text,jsonb) to authenticated;
revoke all on function public.add_savings_to_goal(uuid,numeric) from public;
grant execute on function public.add_savings_to_goal(uuid,numeric) to authenticated;
