-- Migration v1.4: add gender to profiles, used to pick the Male/Female
-- avatar icon shown across the app, and to gate access to the dashboard
-- until a user has completed their profile (full name, phone, gender)
-- after logging in.
--
-- Safe to run once on an existing project. Existing rows get gender = null,
-- which the app treats as "profile incomplete" and routes the user to
-- profile.html to finish setting it up before they can reach Home.

alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female'));
