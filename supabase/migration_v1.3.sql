-- Migration v1.3: fix salary generation bug.
--
-- public.monthly_income originally had:
--   unique(user_id, salary_month) deferrable initially immediate
--
-- generate_salary_for_month() (see functions.sql) relies on
--   insert ... on conflict (user_id, salary_month) do nothing
-- but PostgreSQL does not allow ON CONFLICT to target a deferrable unique
-- constraint/exclusion constraint as its arbiter. Every call to that RPC
-- (fired on every dashboard/income page load, and again when Salary
-- Settings is saved) failed with:
--   "ON CONFLICT does not support deferrable unique constraints/exclusion
--    constraints as arbiters"
-- which in turn made the whole dashboard load fail (greeting name never
-- set, stats stuck at 0) and made Salary Settings show a save error.
--
-- This migration drops the old deferrable constraint and recreates it as a
-- plain (non-deferrable) unique constraint, which Postgres allows to be
-- used as an ON CONFLICT arbiter. Safe to run once on an existing project.

alter table public.monthly_income
  drop constraint if exists monthly_income_user_id_salary_month_key;

alter table public.monthly_income
  add constraint monthly_income_user_id_salary_month_key unique (user_id, salary_month);
