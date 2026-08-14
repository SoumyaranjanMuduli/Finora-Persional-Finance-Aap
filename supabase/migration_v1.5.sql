-- Migration v1.5: integrity, idempotency and atomic updates.
-- Run after v1.4 on an existing project.

do $$ begin
  alter table public.expense_categories add constraint expense_categories_color_format_chk
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.savings_goals add constraint savings_goals_color_format_chk
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.grocery_items add constraint grocery_items_quantity_nonnegative_chk
    check (quantity is null or quantity >= 0);
exception when duplicate_object then null; end $$;

alter table public.grocery_items
  drop constraint if exists grocery_items_price_check;

alter table public.grocery_items
  add constraint grocery_items_price_check check (price > 0);

alter table public.expenses
  add column if not exists source text not null default 'manual';

do $$ begin
  alter table public.expenses add constraint expenses_source_chk
    check (source in ('manual','daily_detail','recurring'));
exception when duplicate_object then null; end $$;

-- Remove duplicate recurring rows before creating the idempotency index.
delete from public.expenses a
using public.expenses b
where a.ctid > b.ctid
  and a.recurring_expense_id is not null
  and a.recurring_expense_id = b.recurring_expense_id
  and a.expense_date = b.expense_date;

create unique index if not exists expenses_recurring_date_unique_idx
  on public.expenses(recurring_expense_id, expense_date)
  where recurring_expense_id is not null;

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
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  update public.savings_goals
     set current_amount = pg_catalog.least(target_amount, current_amount + p_amount)
   where id = p_goal_id and user_id = v_user
   returning current_amount, target_amount into v_current, v_target;
  if not found then raise exception 'Savings goal not found'; end if;
  return pg_catalog.least(v_current, v_target);
end;
$$;

revoke all on function public.add_savings_to_goal(uuid,numeric) from public;
grant execute on function public.add_savings_to_goal(uuid,numeric) to authenticated;

revoke all on function public.generate_recurring_expenses_for_month(date) from public;
grant execute on function public.generate_recurring_expenses_for_month(date) to authenticated;
