-- Add status/last_active to bots (sessions)
alter table public.bots
  add column if not exists status text not null default 'connected',
  add column if not exists last_active timestamptz not null default now(),
  add column if not exists disconnected_at timestamptz;

-- Add ban fields to profiles
alter table public.profiles
  add column if not exists banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists last_active timestamptz not null default now();

-- Pairing logs
create table if not exists public.pairing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  phone_number text not null,
  status text not null, -- 'success' | 'failed' | 'attempt'
  detail text,
  created_at timestamptz not null default now()
);
alter table public.pairing_logs enable row level security;

drop policy if exists "Admins view pairing logs" on public.pairing_logs;
create policy "Admins view pairing logs" on public.pairing_logs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Anyone insert pairing logs" on public.pairing_logs;
create policy "Anyone insert pairing logs" on public.pairing_logs
  for insert to authenticated with check (true);

-- Activity logs
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor_id uuid,
  event text not null, -- 'connect' | 'disconnect' | 'session_deleted' | 'login' | 'ban' | 'unban' | 'setting_change'
  detail text,
  created_at timestamptz not null default now()
);
alter table public.activity_logs enable row level security;

drop policy if exists "Admins view activity logs" on public.activity_logs;
create policy "Admins view activity logs" on public.activity_logs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users insert own activity" on public.activity_logs;
create policy "Users insert own activity" on public.activity_logs
  for insert to authenticated with check (auth.uid() = user_id or auth.uid() = actor_id);

-- Admin settings (key-value)
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.admin_settings enable row level security;

drop policy if exists "Admins manage settings" on public.admin_settings;
create policy "Admins manage settings" on public.admin_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Anyone read settings" on public.admin_settings;
create policy "Anyone read settings" on public.admin_settings
  for select to authenticated using (true);

-- Seed defaults
insert into public.admin_settings(key, value) values
  ('mpesa_till', '"5529503"'::jsonb),
  ('max_sessions_per_user', '3'::jsonb),
  ('max_pairing_attempts_per_hour', '10'::jsonb)
on conflict (key) do nothing;

-- Allow admins to update/delete bots (sessions)
drop policy if exists "Admins update bots" on public.bots;
create policy "Admins update bots" on public.bots
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins delete bots" on public.bots;
create policy "Admins delete bots" on public.bots
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users delete own bots" on public.bots;
create policy "Users delete own bots" on public.bots
  for delete to authenticated using (auth.uid() = user_id);

-- Realtime
alter table public.bots replica identity full;
alter table public.profiles replica identity full;
alter table public.pairing_logs replica identity full;
alter table public.activity_logs replica identity full;

do $$ begin
  begin alter publication supabase_realtime add table public.bots; exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when others then null; end;
  begin alter publication supabase_realtime add table public.pairing_logs; exception when others then null; end;
  begin alter publication supabase_realtime add table public.activity_logs; exception when others then null; end;
end $$;