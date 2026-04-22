create or replace function public.auto_grant_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone = '254111967697' then
    insert into public.user_roles (user_id, role)
    values (new.user_id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_grant_admin on public.profiles;
create trigger trg_auto_grant_admin
after insert on public.profiles
for each row execute function public.auto_grant_admin();