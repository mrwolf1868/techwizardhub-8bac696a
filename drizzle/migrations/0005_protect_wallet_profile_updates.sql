REVOKE UPDATE ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_user_coins(_user_id uuid, _delta integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _balance integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _user_id IS NULL OR _delta IS NULL OR _delta = 0 THEN RAISE EXCEPTION 'Enter a valid adjustment'; END IF;
  SELECT coins INTO _balance FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User wallet not found'; END IF;
  IF _balance + _delta < 0 THEN RAISE EXCEPTION 'Adjustment cannot make a balance negative'; END IF;
  UPDATE public.profiles SET coins = coins + _delta, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (_user_id, 'admin_adjustment', _delta, 'Admin balance adjustment');
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail)
    VALUES (_user_id, auth.uid(), 'balance_adjustment', 'Admin adjusted balance by ' || _delta || ' coins');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_user_coins(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_coins(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_banned(_user_id uuid, _banned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _phone text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _user_id IS NULL OR _banned IS NULL THEN RAISE EXCEPTION 'Invalid user status'; END IF;
  UPDATE public.profiles SET banned = _banned, banned_at = CASE WHEN _banned THEN now() ELSE NULL END, updated_at = now()
    WHERE user_id = _user_id RETURNING phone INTO _phone;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail)
    VALUES (_user_id, auth.uid(), CASE WHEN _banned THEN 'ban' ELSE 'unban' END,
      CASE WHEN _banned THEN 'Banned ' ELSE 'Unbanned ' END || _phone);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_banned(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_banned(uuid, boolean) TO authenticated;