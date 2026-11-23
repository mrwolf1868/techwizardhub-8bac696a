ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS match_mode text NOT NULL DEFAULT 'open';
ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE public.game_matches ADD CONSTRAINT game_matches_match_mode_check CHECK (match_mode IN ('open', 'friend', 'challenge'));
CREATE UNIQUE INDEX IF NOT EXISTS game_matches_invite_code_unique ON public.game_matches (upper(invite_code)) WHERE invite_code IS NOT NULL;
DROP POLICY IF EXISTS "View open or own matches" ON public.game_matches;
CREATE POLICY "View open or own matches" ON public.game_matches FOR SELECT TO authenticated USING (((status = 'waiting') AND (match_mode = 'open')) OR (auth.uid() IN (creator_id, opponent_id)) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.wallet_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL CHECK (phone ~ '^254[17][0-9]{8}$'),
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_withdrawals TO authenticated;
GRANT ALL ON public.wallet_withdrawals TO service_role;
ALTER TABLE public.wallet_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and admins view withdrawal requests" ON public.wallet_withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX wallet_withdrawals_user_created_idx ON public.wallet_withdrawals (user_id, created_at DESC);

CREATE TABLE public.admin_profit_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  phone text NOT NULL CHECK (phone ~ '^254[17][0-9]{8}$'),
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_profit_withdrawals TO authenticated;
GRANT ALL ON public.admin_profit_withdrawals TO service_role;
ALTER TABLE public.admin_profit_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view profit withdrawals" ON public.admin_profit_withdrawals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX admin_profit_withdrawals_admin_created_idx ON public.admin_profit_withdrawals (created_by, created_at DESC);

CREATE OR REPLACE FUNCTION public.game_create_match_with_mode(_game text, _stake integer, _state text, _match_mode text, _opponent_id uuid DEFAULT NULL, _invite_code text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _game NOT IN ('chess', 'draughts') THEN RAISE EXCEPTION 'Invalid game'; END IF;
  IF _stake IS NULL OR _stake <= 0 OR _stake > 100000 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  IF _match_mode NOT IN ('open', 'friend', 'challenge') THEN RAISE EXCEPTION 'Invalid match mode'; END IF;
  IF _match_mode = 'open' AND (_opponent_id IS NOT NULL OR _invite_code IS NOT NULL) THEN RAISE EXCEPTION 'Invalid open match details'; END IF;
  IF _match_mode = 'friend' AND (_opponent_id IS NOT NULL OR _invite_code IS NULL OR upper(trim(_invite_code)) !~ '^[A-Z0-9]{6}$') THEN RAISE EXCEPTION 'Invalid friend code'; END IF;
  IF _match_mode = 'challenge' AND (_opponent_id IS NULL OR _opponent_id = _uid OR _invite_code IS NOT NULL) THEN RAISE EXCEPTION 'Invalid challenge target'; END IF;
  PERFORM public.game_charge_entry(_uid, _stake, _game);
  INSERT INTO public.game_matches (game_type, stake, creator_id, opponent_id, state, turn, house_fee, match_mode, invite_code)
  VALUES (_game, _stake, _uid, _opponent_id, _state, _uid, public.game_entry_fee(_stake), _match_mode,
    CASE WHEN _match_mode = 'friend' THEN upper(trim(_invite_code)) ELSE NULL END)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_create_match_with_mode(text, integer, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_create_match_with_mode(text, integer, text, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.game_join_match(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.game_matches; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO m FROM public.game_matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'waiting' THEN RAISE EXCEPTION 'Match not available'; END IF;
  IF m.creator_id = _uid THEN RAISE EXCEPTION 'Cannot join your own match'; END IF;
  IF m.opponent_id IS NOT NULL AND m.opponent_id <> _uid THEN RAISE EXCEPTION 'This invitation is for another player'; END IF;
  PERFORM public.game_charge_entry(_uid, m.stake, m.game_type);
  UPDATE public.game_matches SET opponent_id = _uid, status = 'active', house_fee = house_fee + public.game_entry_fee(m.stake), updated_at = now() WHERE id = _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_join_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_join_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.game_join_match_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _code IS NULL OR upper(trim(_code)) !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'Enter a valid 6-character friend code'; END IF;
  SELECT id INTO _id FROM public.game_matches WHERE match_mode = 'friend' AND status = 'waiting' AND upper(invite_code) = upper(trim(_code)) FOR UPDATE;
  IF _id IS NULL THEN RAISE EXCEPTION 'Friend match not found or already joined'; END IF;
  PERFORM public.game_join_match(_id);
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_join_match_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_join_match_by_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.game_settle(_id uuid, _winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.game_matches; pot integer;
BEGIN
  SELECT * INTO m FROM public.game_matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'active' THEN RETURN; END IF;
  pot := m.stake * 2;
  IF _winner IS NULL THEN
    UPDATE public.profiles SET coins = coins + m.stake, last_active = now(), updated_at = now() WHERE user_id IN (m.creator_id, m.opponent_id);
    INSERT INTO public.transactions (user_id, type, amount, description)
      SELECT u, 'game', m.stake, initcap(m.game_type) || ' draw refund' FROM unnest(ARRAY[m.creator_id, m.opponent_id]) u;
  ELSE
    IF _winner NOT IN (m.creator_id, m.opponent_id) THEN RAISE EXCEPTION 'Invalid winner'; END IF;
    UPDATE public.profiles SET coins = coins + pot, last_active = now(), updated_at = now() WHERE user_id = _winner;
    INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_winner, 'game', pot, initcap(m.game_type) || ' win');
  END IF;
  UPDATE public.profiles SET games_played = games_played + 1, last_active = now(), updated_at = now() WHERE user_id IN (m.creator_id, m.opponent_id);
  UPDATE public.game_matches SET status = 'finished', winner_id = _winner, updated_at = now() WHERE id = _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_settle(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(_amount integer, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  UPDATE public.profiles SET coins = coins - _amount, last_active = now(), updated_at = now() WHERE user_id = _uid AND coins >= _amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO public.wallet_withdrawals (user_id, phone, amount) VALUES (_uid, _phone, _amount) RETURNING id INTO _id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'withdrawal', -_amount, 'M-Pesa withdrawal request');
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_uid, _uid, 'withdrawal_request', 'Requested KSh ' || _amount || ' to ' || _phone);
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_wallet_withdrawal(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_wallet_withdrawal(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wallet_withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _status NOT IN ('paid', 'rejected') THEN RAISE EXCEPTION 'Invalid withdrawal status'; END IF;
  SELECT * INTO w FROM public.wallet_withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal is no longer pending'; END IF;
  UPDATE public.wallet_withdrawals SET status = _status, processed_by = auth.uid(), processed_at = now() WHERE id = _id;
  IF _status = 'rejected' THEN
    UPDATE public.profiles SET coins = coins + w.amount, last_active = now(), updated_at = now() WHERE user_id = w.user_id;
    INSERT INTO public.transactions (user_id, type, amount, description) VALUES (w.user_id, 'withdrawal_refund', w.amount, 'M-Pesa withdrawal request rejected — balance returned');
  END IF;
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (w.user_id, auth.uid(), 'withdrawal_' || _status, 'KSh ' || w.amount || ' withdrawal to ' || w.phone);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_wallet_withdrawal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_wallet_withdrawal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_profit_summary()
RETURNS TABLE(total_fees bigint, total_withdrawn bigint, available bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT f.total_fees, w.total_withdrawn, f.total_fees - w.total_withdrawn
    FROM (SELECT COALESCE(SUM(t.amount), 0)::bigint AS total_fees FROM public.transactions t WHERE t.user_id = _uid AND t.type = 'house_fee') f
    CROSS JOIN (SELECT COALESCE(SUM(p.amount), 0)::bigint AS total_withdrawn FROM public.admin_profit_withdrawals p WHERE p.created_by = _uid) w;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_profit_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_profit_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_profit_withdrawal(_amount integer, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _fees bigint; _withdrawn bigint; _balance integer; _id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  SELECT coins INTO _balance FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin wallet not found'; END IF;
  SELECT COALESCE(SUM(amount), 0)::bigint INTO _fees FROM public.transactions WHERE user_id = _uid AND type = 'house_fee';
  SELECT COALESCE(SUM(amount), 0)::bigint INTO _withdrawn FROM public.admin_profit_withdrawals WHERE created_by = _uid;
  IF _amount::bigint > _fees - _withdrawn THEN RAISE EXCEPTION 'Withdrawal exceeds available match fees'; END IF;
  IF _amount > _balance THEN RAISE EXCEPTION 'Insufficient admin balance'; END IF;
  INSERT INTO public.admin_profit_withdrawals (created_by, phone, amount) VALUES (_uid, _phone, _amount) RETURNING id INTO _id;
  UPDATE public.profiles SET coins = coins - _amount, last_active = now(), updated_at = now() WHERE user_id = _uid;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'profit_withdrawal', -_amount, 'Recorded match-fee withdrawal to ' || _phone);
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_uid, _uid, 'profit_withdrawal', 'Recorded KSh ' || _amount || ' withdrawn to ' || _phone);
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_record_profit_withdrawal(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_profit_withdrawal(integer, text) TO authenticated;