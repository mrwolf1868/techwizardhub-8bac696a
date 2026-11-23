ALTER TABLE public.profiles ALTER COLUMN coins SET DEFAULT 0;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_phone text; v_email text; v_code text;
begin
  v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
  v_email := nullif(new.raw_user_meta_data->>'real_email', '');
  v_code := 'TW' || upper(substr(md5(new.id::text), 1, 6));
  if v_phone !~ '^[1-9][0-9]{7,14}$' then raise exception 'Invalid phone number format'; end if;
  if exists (select 1 from public.profiles where phone = v_phone) then raise exception 'Phone number already registered'; end if;
  insert into public.profiles (user_id, phone, email, referral_code, coins) values (new.id, v_phone, v_email, v_code, 0);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$function$;