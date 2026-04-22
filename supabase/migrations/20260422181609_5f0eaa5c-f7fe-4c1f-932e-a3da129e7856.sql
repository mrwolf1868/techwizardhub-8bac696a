-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view their own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

create policy "Admins can view all roles"
on public.user_roles for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
on public.user_roles for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  phone text not null unique,
  email text,
  coins integer not null default 70,
  games_played integer not null default 0,
  bots_deployed integer not null default 0,
  referral_code text not null unique,
  referred_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users view own profile" on public.profiles
for select to authenticated using (auth.uid() = user_id);

create policy "Users update own profile" on public.profiles
for update to authenticated using (auth.uid() = user_id);

create policy "Users insert own profile" on public.profiles
for insert to authenticated with check (auth.uid() = user_id);

create policy "Admins view all profiles" on public.profiles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admins update all profiles" on public.profiles
for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  amount integer not null,
  description text not null,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;

create policy "Users view own tx" on public.transactions
for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own tx" on public.transactions
for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins view all tx" on public.transactions
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Bots
create table public.bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  phone_number text not null,
  code text not null,
  deployed_at timestamptz not null default now()
);
alter table public.bots enable row level security;

create policy "Users view own bots" on public.bots
for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own bots" on public.bots
for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins view all bots" on public.bots
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Password reset codes
create table public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.password_reset_codes enable row level security;
-- No client policies — only edge functions (service role) use it.

create index idx_reset_email on public.password_reset_codes(email);

-- updated_at trigger
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Auto-create profile + role on signup
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

  insert into public.profiles (user_id, phone, email, referral_code, referred_by, coins)
  values (new.id, v_phone, v_email, v_code, v_ref, 70);

  insert into public.transactions (user_id, type, amount, description)
  values (new.id, 'welcome', 70, 'Welcome bonus 🎉');

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  -- Referral bonus to referrer
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();