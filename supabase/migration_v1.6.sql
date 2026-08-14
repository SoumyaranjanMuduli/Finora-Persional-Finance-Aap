-- Migration v1.6: new expense taxonomy (12 main categories, each with its
-- own subcategories) replaces the old flat 5-category default set.
-- Run after v1.5 on an existing project.
--
-- This only touches the *default* rows in expense_categories (the ones the
-- signup trigger seeds). It does not rename or delete anything on existing
-- `expenses` rows — old category_name/subcategory values on historical
-- expenses are left as-is and still display fine, they just won't line up
-- with the new dropdown options going forward.

-- Drop the old default categories for every user that still has them.
delete from public.expense_categories
where is_default = true
  and name in ('Room Rent','Grocery','Bus Travel','Cab Travel','Online Travel');

-- Seed the new 12 main categories (+ Other Spend) as defaults for every
-- existing user, matching js/utils.js expenseGroups exactly.
insert into public.expense_categories(user_id,name,is_default,color)
select u.id, c.name, true, c.color
from auth.users u
cross join (values
  ('Mobile & Connectivity','#2588ff'),
  ('Food & Groceries','#05d99b'),
  ('Transport','#f5a623'),
  ('Shopping','#e91e8c'),
  ('Bills & Utilities','#8c4dff'),
  ('Health & Fitness','#00a7a7'),
  ('Entertainment & Subscriptions','#6b4dff'),
  ('Travel','#0aa66e'),
  ('Personal Care','#ff6f91'),
  ('Education & Work','#3f6bff'),
  ('Finance','#2ea043'),
  ('Family & Others','#8a63d2'),
  ('Other Spend','#ff4b55')
) as c(name, color)
on conflict (user_id, name) do nothing;
