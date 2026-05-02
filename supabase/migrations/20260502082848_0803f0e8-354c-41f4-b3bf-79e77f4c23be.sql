
-- 1. service_pricing
create table public.service_pricing (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique,
  name text not null,
  price_coins integer not null default 0,
  continuation_price_coins integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.service_pricing enable row level security;
create policy "Anyone read enabled pricing" on public.service_pricing
  for select to authenticated using (enabled = true or has_role(auth.uid(), 'admin'));
create policy "Admins manage pricing" on public.service_pricing
  for all to authenticated using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));
create trigger trg_service_pricing_upd before update on public.service_pricing
  for each row execute function public.update_updated_at_column();

-- 2. child_projects
create table public.child_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  url text not null,
  service_key text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.child_projects enable row level security;
create policy "Auth read enabled child projects" on public.child_projects
  for select to authenticated using (enabled = true or has_role(auth.uid(), 'admin'));
create policy "Admins manage child projects" on public.child_projects
  for all to authenticated using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));
create trigger trg_child_projects_upd before update on public.child_projects
  for each row execute function public.update_updated_at_column();

-- 3. service_usage
create table public.service_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  service_key text not null,
  usage_start_at timestamptz not null default now(),
  free_trial_expired boolean not null default false,
  paid_continuation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.service_usage enable row level security;
create policy "Users view own usage" on public.service_usage
  for select to authenticated using (auth.uid() = user_id or has_role(auth.uid(),'admin'));
create policy "Users insert own usage" on public.service_usage
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own usage" on public.service_usage
  for update to authenticated using (auth.uid() = user_id);
create index idx_service_usage_user on public.service_usage(user_id, service_key, usage_start_at desc);
create trigger trg_service_usage_upd before update on public.service_usage
  for each row execute function public.update_updated_at_column();

-- 4. transfer_tokens
create table public.transfer_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null,
  child_slug text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.transfer_tokens enable row level security;
create policy "Users see own tokens" on public.transfer_tokens
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own tokens" on public.transfer_tokens
  for insert to authenticated with check (auth.uid() = user_id);

-- 5. Update handle_new_user: 30 coins for NEW signups (existing untouched)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_email text;
  v_ref text;
  v_code text;
begin
  v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
  v_email := nullif(new.raw_user_meta_data->>'real_email', '');
  v_ref := nullif(new.raw_user_meta_data->>'referred_by', '');
  v_code := 'TW' || upper(substr(md5(new.id::text), 1, 6));

  if v_phone !~ '^[1-9][0-9]{7,14}$' then
    raise exception 'Invalid phone number format';
  end if;

  if exists (select 1 from public.profiles where phone = v_phone) then
    raise exception 'Phone number already registered';
  end if;

  insert into public.profiles (user_id, phone, email, referral_code, referred_by, coins)
  values (new.id, v_phone, v_email, v_code, v_ref, 30);

  insert into public.transactions (user_id, type, amount, description)
  values (new.id, 'welcome', 30, 'Welcome bonus 🎉');

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  if v_ref is not null then
    update public.profiles set coins = coins + 30
    where referral_code = v_ref;

    insert into public.transactions (user_id, type, amount, description)
    select user_id, 'referral', 30, 'Referral bonus from ' || v_code
    from public.profiles where referral_code = v_ref;
  end if;

  return new;
end;
$$;

-- Update profiles default for any future raw inserts
alter table public.profiles alter column coins set default 30;
