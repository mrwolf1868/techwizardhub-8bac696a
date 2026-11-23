ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS creator_charged boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.game_create_match_with_mode(_game text, _stake integer, _state text, _match_mode text, _opponent_id uuid DEFAULT NULL, _invite_code text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid(); _coins integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _game NOT IN ('chess', 'draughts') THEN RAISE EXCEPTION 'Invalid game'; END IF;
  IF _stake IS NULL OR _stake <= 0 OR _stake > 100000 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  IF _match_mode NOT IN ('open', 'friend', 'challenge') THEN RAISE EXCEPTION 'Invalid match mode'; END IF;
  IF _match_mode = 'open' AND (_opponent_id IS NOT NULL OR _invite_code IS NOT NULL) THEN RAISE EXCEPTION 'Invalid open match details'; END IF;
  IF _match_mode = 'friend' AND (_opponent_id IS NOT NULL OR _invite_code IS NULL OR upper(trim(_invite_code)) !~ '^[A-Z0-9]{6}$') THEN RAISE EXCEPTION 'Invalid friend code'; END IF;
  IF _match_mode = 'challenge' AND (_opponent_id IS NULL OR _opponent_id = _uid OR _invite_code IS NOT NULL) THEN RAISE EXCEPTION 'Invalid challenge target'; END IF;
  SELECT coins INTO _coins FROM public.profiles WHERE user_id = _uid;
  IF COALESCE(_coins, 0) < _stake + public.game_entry_fee(_stake) THEN
    RAISE EXCEPTION 'Insufficient balance (stake % + entry fee %)', _stake, public.game_entry_fee(_stake);
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_matches WHERE creator_id = _uid AND status = 'waiting') THEN
    RAISE EXCEPTION 'You already have a match search open. Cancel it before starting another.';
  END IF;
  INSERT INTO public.game_matches (game_type, stake, creator_id, opponent_id, invited_user_id, state, turn, house_fee, match_mode, invite_code, creator_charged)
  VALUES (_game, _stake, _uid, NULL, CASE WHEN _match_mode = 'challenge' THEN _opponent_id ELSE NULL END,
    _state, _uid, 0, _match_mode,
    CASE WHEN _match_mode = 'friend' THEN upper(trim(_invite_code)) ELSE NULL END, false)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_create_match_with_mode(text, integer, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_create_match_with_mode(text, integer, text, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.game_join_match(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.game_matches; _uid uuid := auth.uid(); _fee integer; _creator_coins integer; _added integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO m FROM public.game_matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'waiting' THEN RAISE EXCEPTION 'Match not available'; END IF;
  IF m.creator_id = _uid THEN RAISE EXCEPTION 'Cannot join your own match'; END IF;
  IF m.match_mode = 'challenge' AND m.invited_user_id IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'This invitation is for another player'; END IF;
  IF m.opponent_id IS NOT NULL THEN RAISE EXCEPTION 'Match already has an opponent'; END IF;
  _fee := public.game_entry_fee(m.stake);
  _added := _fee;
  IF NOT m.creator_charged THEN
    SELECT coins INTO _creator_coins FROM public.profiles WHERE user_id = m.creator_id FOR UPDATE;
    IF COALESCE(_creator_coins, 0) < m.stake + _fee THEN
      RAISE EXCEPTION 'The player who opened this match no longer has enough balance';
    END IF;
  END IF;
  PERFORM public.game_charge_entry(_uid, m.stake, m.game_type);
  IF NOT m.creator_charged THEN
    PERFORM public.game_charge_entry(m.creator_id, m.stake, m.game_type);
    _added := _added + _fee;
  END IF;
  UPDATE public.game_matches SET opponent_id = _uid, status = 'active', creator_charged = true,
    house_fee = house_fee + _added, updated_at = now() WHERE id = _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_join_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_join_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.game_resign(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.game_matches; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO m FROM public.game_matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR _uid IS NULL OR _uid NOT IN (m.creator_id, COALESCE(m.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN RAISE EXCEPTION 'Not your match'; END IF;
  IF m.status = 'waiting' THEN
    IF m.creator_charged THEN
      UPDATE public.profiles SET coins = coins + m.stake WHERE user_id = m.creator_id;
      INSERT INTO public.transactions (user_id, type, amount, description) VALUES (m.creator_id, 'game', m.stake, 'Match cancelled refund');
    END IF;
    UPDATE public.game_matches SET status = 'cancelled', updated_at = now() WHERE id = _id;
  ELSIF m.status = 'active' THEN
    PERFORM public.game_settle(_id, CASE WHEN _uid = m.creator_id THEN m.opponent_id ELSE m.creator_id END);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_resign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_resign(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_match(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.game_matches;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO m FROM public.game_matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status NOT IN ('waiting', 'active') THEN RAISE EXCEPTION 'Match is already closed'; END IF;
  UPDATE public.profiles SET coins = coins + m.stake
    WHERE user_id IN (CASE WHEN m.creator_charged THEN m.creator_id END, m.opponent_id);
  INSERT INTO public.transactions (user_id, type, amount, description)
    SELECT u, 'game', m.stake, 'Match cancelled by admin — stake refunded'
    FROM unnest(ARRAY[CASE WHEN m.creator_charged THEN m.creator_id END, m.opponent_id]) u WHERE u IS NOT NULL;
  UPDATE public.game_matches SET status = 'cancelled', updated_at = now() WHERE id = _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_match(uuid) TO authenticated;

-- Payout tracking
ALTER TABLE public.wallet_withdrawals DROP CONSTRAINT IF EXISTS wallet_withdrawals_status_check;
ALTER TABLE public.wallet_withdrawals ADD CONSTRAINT wallet_withdrawals_status_check CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'rejected'));
ALTER TABLE public.wallet_withdrawals ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE public.wallet_withdrawals ADD COLUMN IF NOT EXISTS originator_conversation_id text;
ALTER TABLE public.wallet_withdrawals ADD COLUMN IF NOT EXISTS mpesa_receipt text;
ALTER TABLE public.wallet_withdrawals ADD COLUMN IF NOT EXISTS result_desc text;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_withdrawals_conversation_unique ON public.wallet_withdrawals (conversation_id) WHERE conversation_id IS NOT NULL;

ALTER TABLE public.admin_profit_withdrawals ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid';
ALTER TABLE public.admin_profit_withdrawals ADD CONSTRAINT admin_profit_withdrawals_status_check CHECK (status IN ('processing', 'paid', 'failed'));
ALTER TABLE public.admin_profit_withdrawals ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE public.admin_profit_withdrawals ADD COLUMN IF NOT EXISTS originator_conversation_id text;
ALTER TABLE public.admin_profit_withdrawals ADD COLUMN IF NOT EXISTS mpesa_receipt text;
ALTER TABLE public.admin_profit_withdrawals ADD COLUMN IF NOT EXISTS result_desc text;
ALTER TABLE public.admin_profit_withdrawals ADD COLUMN IF NOT EXISTS processed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS admin_profit_withdrawals_conversation_unique ON public.admin_profit_withdrawals (conversation_id) WHERE conversation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_get_profit_summary()
RETURNS TABLE(total_fees bigint, total_withdrawn bigint, available bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT f.total_fees, w.total_withdrawn, f.total_fees - w.total_withdrawn
    FROM (SELECT COALESCE(SUM(t.amount), 0)::bigint AS total_fees FROM public.transactions t WHERE t.user_id = _uid AND t.type = 'house_fee') f
    CROSS JOIN (SELECT COALESCE(SUM(p.amount), 0)::bigint AS total_withdrawn FROM public.admin_profit_withdrawals p WHERE p.created_by = _uid AND p.status IN ('processing', 'paid')) w;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_profit_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_profit_summary() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_wallet_withdrawal(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_record_profit_withdrawal(integer, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.payout_reserve_wallet(_uid uuid, _amount integer, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _amount IS NULL OR _amount < 10 OR _amount > 150000 THEN RAISE EXCEPTION 'Enter an amount from 10 to 150,000'; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND banned) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  UPDATE public.profiles SET coins = coins - _amount, last_active = now(), updated_at = now() WHERE user_id = _uid AND coins >= _amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO public.wallet_withdrawals (user_id, phone, amount) VALUES (_uid, _phone, _amount) RETURNING id INTO _id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'withdrawal', -_amount, 'M-Pesa withdrawal to ' || _phone);
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_uid, _uid, 'withdrawal_request', 'Requested KSh ' || _amount || ' to ' || _phone);
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.payout_reserve_wallet(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_reserve_wallet(uuid, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.payout_reserve_profit(_uid uuid, _amount integer, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _fees bigint; _withdrawn bigint; _balance integer; _id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _amount IS NULL OR _amount < 10 OR _amount > 150000 THEN RAISE EXCEPTION 'Enter an amount from 10 to 150,000'; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  SELECT coins INTO _balance FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin wallet not found'; END IF;
  SELECT COALESCE(SUM(amount), 0)::bigint INTO _fees FROM public.transactions WHERE user_id = _uid AND type = 'house_fee';
  SELECT COALESCE(SUM(amount), 0)::bigint INTO _withdrawn FROM public.admin_profit_withdrawals WHERE created_by = _uid AND status IN ('processing', 'paid');
  IF _amount::bigint > _fees - _withdrawn THEN RAISE EXCEPTION 'Withdrawal exceeds available match fees'; END IF;
  IF _amount > _balance THEN RAISE EXCEPTION 'Insufficient admin balance'; END IF;
  INSERT INTO public.admin_profit_withdrawals (created_by, phone, amount, status) VALUES (_uid, _phone, _amount, 'processing') RETURNING id INTO _id;
  UPDATE public.profiles SET coins = coins - _amount, updated_at = now() WHERE user_id = _uid;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'profit_withdrawal', -_amount, 'Match-fee withdrawal to ' || _phone);
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_uid, _uid, 'profit_withdrawal', 'Started KSh ' || _amount || ' payout to ' || _phone);
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.payout_reserve_profit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_reserve_profit(uuid, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.payout_mark_processing(_kind text, _id uuid, _conversation_id text, _originator_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind = 'wallet' THEN
    UPDATE public.wallet_withdrawals SET status = 'processing', conversation_id = _conversation_id, originator_conversation_id = _originator_id
      WHERE id = _id AND status IN ('pending', 'processing');
  ELSIF _kind = 'profit' THEN
    UPDATE public.admin_profit_withdrawals SET conversation_id = _conversation_id, originator_conversation_id = _originator_id
      WHERE id = _id AND status = 'processing';
  ELSE RAISE EXCEPTION 'Invalid payout kind'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.payout_mark_processing(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_mark_processing(text, uuid, text, text) TO service_role;

-- Finalise a payout exactly once. Lookup by id (kind + id) or by M-Pesa conversation ids.
CREATE OR REPLACE FUNCTION public.payout_complete(_kind text, _id uuid, _conversation_id text, _originator_id text, _success boolean, _receipt text, _desc text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wallet_withdrawals; p public.admin_profit_withdrawals;
BEGIN
  IF _kind IS NULL OR _kind = 'wallet' THEN
    SELECT * INTO w FROM public.wallet_withdrawals
      WHERE (_id IS NOT NULL AND id = _id)
         OR (_id IS NULL AND ((_conversation_id IS NOT NULL AND conversation_id = _conversation_id) OR (_originator_id IS NOT NULL AND originator_conversation_id = _originator_id)))
      LIMIT 1 FOR UPDATE;
    IF w.id IS NOT NULL THEN
      IF w.status NOT IN ('pending', 'processing') THEN RETURN 'already_final'; END IF;
      IF _success THEN
        UPDATE public.wallet_withdrawals SET status = 'paid', mpesa_receipt = _receipt, result_desc = _desc, processed_at = now() WHERE id = w.id;
      ELSE
        UPDATE public.wallet_withdrawals SET status = 'failed', result_desc = _desc, processed_at = now() WHERE id = w.id;
        UPDATE public.profiles SET coins = coins + w.amount, updated_at = now() WHERE user_id = w.user_id;
        INSERT INTO public.transactions (user_id, type, amount, description) VALUES (w.user_id, 'withdrawal_refund', w.amount, 'M-Pesa withdrawal failed — balance returned');
      END IF;
      RETURN 'wallet';
    END IF;
  END IF;
  IF _kind IS NULL OR _kind = 'profit' THEN
    SELECT * INTO p FROM public.admin_profit_withdrawals
      WHERE (_id IS NOT NULL AND id = _id)
         OR (_id IS NULL AND ((_conversation_id IS NOT NULL AND conversation_id = _conversation_id) OR (_originator_id IS NOT NULL AND originator_conversation_id = _originator_id)))
      LIMIT 1 FOR UPDATE;
    IF p.id IS NOT NULL THEN
      IF p.status <> 'processing' THEN RETURN 'already_final'; END IF;
      IF _success THEN
        UPDATE public.admin_profit_withdrawals SET status = 'paid', mpesa_receipt = _receipt, result_desc = _desc, processed_at = now() WHERE id = p.id;
      ELSE
        UPDATE public.admin_profit_withdrawals SET status = 'failed', result_desc = _desc, processed_at = now() WHERE id = p.id;
        UPDATE public.profiles SET coins = coins + p.amount, updated_at = now() WHERE user_id = p.created_by;
        INSERT INTO public.transactions (user_id, type, amount, description) VALUES (p.created_by, 'withdrawal_refund', p.amount, 'Match-fee payout failed — returned to profit');
      END IF;
      RETURN 'profit';
    END IF;
  END IF;
  RETURN 'not_found';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.payout_complete(text, uuid, text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_complete(text, uuid, text, text, boolean, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_resolve_wallet_withdrawal(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wallet_withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _status <> 'rejected' THEN RAISE EXCEPTION 'Payouts are confirmed by M-Pesa only'; END IF;
  SELECT * INTO w FROM public.wallet_withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status <> 'pending' THEN RAISE EXCEPTION 'Only requests not yet sent to M-Pesa can be rejected'; END IF;
  UPDATE public.wallet_withdrawals SET status = 'rejected', processed_by = auth.uid(), processed_at = now() WHERE id = _id;
  UPDATE public.profiles SET coins = coins + w.amount, updated_at = now() WHERE user_id = w.user_id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (w.user_id, 'withdrawal_refund', w.amount, 'M-Pesa withdrawal rejected — balance returned');
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (w.user_id, auth.uid(), 'withdrawal_rejected', 'Rejected KSh ' || w.amount);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_wallet_withdrawal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_wallet_withdrawal(uuid, text) TO authenticated;

-- Keep private payment keys readable by admins only
DROP POLICY IF EXISTS "Anyone read settings" ON public.admin_settings;
CREATE POLICY "Anyone read public settings" ON public.admin_settings FOR SELECT TO authenticated
  USING ((key NOT IN ('mpesa_consumer_key', 'mpesa_consumer_secret', 'mpesa_passkey') AND key NOT LIKE 'mpesa_b2c_%') OR public.has_role(auth.uid(), 'admin'::public.app_role));