
ALTER TABLE public.child_projects
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS price_coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS continuation_price_coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_trial_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
