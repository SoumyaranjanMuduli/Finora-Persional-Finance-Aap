-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================
-- Every user-owned table uses auth.uid() = user_id for complete isolation.
-- Policies are explicit (not generated) for auditability and clarity.
-- ============================================================================

-- Enable RLS on all user-owned tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES
-- ============================================================================
CREATE POLICY "Users can select own profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- USER_PREFERENCES
-- ============================================================================
CREATE POLICY "Users can select own user_preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_preferences" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SALARY_SETTINGS
-- ============================================================================
CREATE POLICY "Users can select own salary_settings" ON public.salary_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own salary_settings" ON public.salary_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own salary_settings" ON public.salary_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own salary_settings" ON public.salary_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- MONTHLY_INCOME
-- ============================================================================
CREATE POLICY "Users can select own monthly_income" ON public.monthly_income
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly_income" ON public.monthly_income
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly_income" ON public.monthly_income
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly_income" ON public.monthly_income
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- EXPENSE_CATEGORIES
-- ============================================================================
CREATE POLICY "Users can select own expense_categories" ON public.expense_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense_categories" ON public.expense_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expense_categories" ON public.expense_categories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense_categories" ON public.expense_categories
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- EXPENSES
-- ============================================================================
CREATE POLICY "Users can select own expenses" ON public.expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses" ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON public.expenses
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- GROCERY_ITEMS
-- ============================================================================
CREATE POLICY "Users can select own grocery_items" ON public.grocery_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grocery_items" ON public.grocery_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grocery_items" ON public.grocery_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery_items" ON public.grocery_items
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRAVEL_EXPENSES
-- ============================================================================
CREATE POLICY "Users can select own travel_expenses" ON public.travel_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own travel_expenses" ON public.travel_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own travel_expenses" ON public.travel_expenses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own travel_expenses" ON public.travel_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- ROOM_EXPENSES
-- ============================================================================
CREATE POLICY "Users can select own room_expenses" ON public.room_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own room_expenses" ON public.room_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own room_expenses" ON public.room_expenses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own room_expenses" ON public.room_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- DAILY_STATUS
-- ============================================================================
CREATE POLICY "Users can select own daily_status" ON public.daily_status
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_status" ON public.daily_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily_status" ON public.daily_status
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily_status" ON public.daily_status
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE POLICY "Users can select own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- BUDGETS
-- ============================================================================
CREATE POLICY "Users can select own budgets" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SAVINGS_GOALS
-- ============================================================================
CREATE POLICY "Users can select own savings_goals" ON public.savings_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings_goals" ON public.savings_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings_goals" ON public.savings_goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings_goals" ON public.savings_goals
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- RECURRING_EXPENSES
-- ============================================================================
CREATE POLICY "Users can select own recurring_expenses" ON public.recurring_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring_expenses" ON public.recurring_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring_expenses" ON public.recurring_expenses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring_expenses" ON public.recurring_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PRIVATE STORAGE: Receipts
-- ============================================================================
-- Private bucket for user-uploaded receipts. Files are stored as {auth.uid()}/filename
INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own receipts" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own receipts" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own receipts" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own receipts" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
