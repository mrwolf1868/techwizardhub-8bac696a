-- Server-side guard: phone numbers must be 8-15 digits in E.164 form (no leading +)
-- and unique across all profiles.

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_format_chk
  CHECK (phone ~ '^[1-9][0-9]{7,14}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone);

-- Tighten the new-user trigger so registrations missing or with malformed phones are rejected.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  values (new.id, v_phone, v_email, v_code, v_ref, 70);

  insert into public.transactions (user_id, type, amount, description)
  values (new.id, 'welcome', 70, 'Welcome bonus 🎉');

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
$function$;