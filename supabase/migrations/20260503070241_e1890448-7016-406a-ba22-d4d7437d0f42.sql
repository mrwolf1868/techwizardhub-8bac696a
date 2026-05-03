ALTER TABLE public.child_projects 
  ADD COLUMN IF NOT EXISTS continuation_duration_value integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS continuation_duration_unit text NOT NULL DEFAULT 'days';