ALTER TABLE public.game_matches DROP CONSTRAINT IF EXISTS game_matches_game_type_check;
ALTER TABLE public.game_matches ADD CONSTRAINT game_matches_game_type_check CHECK (game_type IN ('chess','draughts','tictactoe','connect4'));

CREATE OR REPLACE FUNCTION public.setting_int(_key text, _field text, _default integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE WHEN jsonb_typeof(value -> _field) = 'number' THEN floor((value ->> _field)::numeric)::integer END
    FROM public.admin_settings WHERE key = _key
  ), _default)
$$;

CREATE OR REPLACE FUNCTION public.game_is_locked(_game text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT jsonb_typeof(value) = 'array' AND value ? _game FROM public.admin_settings WHERE key = 'locked_games'), false)
$$;

CREATE OR REPLACE FUNCTION public.game_create_match_with_mode(_game text, _stake integer, _state text, _match_mode text, _opponent_id uuid DEFAULT NULL::uuid, _invite_code text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _id uuid; _uid uuid := auth.uid(); _coins integer; _min integer; _max integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _game NOT IN ('chess', 'draughts', 'tictactoe', 'connect4') THEN RAISE EXCEPTION 'Invalid game'; END IF;
  IF public.game_is_locked(_game) THEN RAISE EXCEPTION 'This game is currently locked'; END IF;
  _min := GREATEST(1, public.setting_int('stake_limits', 'min', 1));
  _max := LEAST(100000, public.setting_int('stake_limits', 'max', 100000));
  IF _stake IS NULL OR _stake < _min OR _stake > _max THEN RAISE EXCEPTION 'Stake must be from KSh % to KSh %', _min, _max; END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.game_join_match(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE m public.game_matches; _uid uuid := auth.uid(); _fee integer; _creator_coins integer; _added integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO m FROM public.game_matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'waiting' THEN RAISE EXCEPTION 'Match not available'; END IF;
  IF public.game_is_locked(m.game_type) THEN RAISE EXCEPTION 'This game is currently locked'; END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.payout_reserve_wallet(_uid uuid, _amount integer, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _id uuid; _min integer; _max integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _min := GREATEST(1, public.setting_int('wallet_limits', 'min_withdraw', 10));
  _max := LEAST(150000, public.setting_int('wallet_limits', 'max_withdraw', 150000));
  IF _amount IS NULL OR _amount < _min OR _amount > _max THEN RAISE EXCEPTION 'Withdrawals must be from KSh % to KSh %', _min, _max; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND banned) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  UPDATE public.profiles SET coins = coins - _amount, last_active = now(), updated_at = now() WHERE user_id = _uid AND coins >= _amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO public.wallet_withdrawals (user_id, phone, amount) VALUES (_uid, _phone, _amount) RETURNING id INTO _id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'withdrawal', -_amount, 'M-Pesa withdrawal to ' || _phone);
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_uid, _uid, 'withdrawal_request', 'Requested KSh ' || _amount || ' to ' || _phone);
  RETURN _id;
END;
$function$;

CREATE TABLE public.game_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_chat_room_check CHECK (room ~ '^(lobby:(chess|draughts|tictactoe|connect4)|match:[0-9a-f-]{36})$'),
  CONSTRAINT game_chat_body_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 300)
);
CREATE INDEX game_chat_messages_room_created_idx ON public.game_chat_messages (room, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.game_chat_messages TO authenticated;
GRANT ALL ON public.game_chat_messages TO service_role;
ALTER TABLE public.game_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_chat_room(_room text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _room LIKE 'lobby:%'
    OR public.has_role(auth.uid(), 'admin')
    OR (_room LIKE 'match:%' AND EXISTS (
      SELECT 1 FROM public.game_matches m
      WHERE m.id::text = substr(_room, 7) AND auth.uid() IN (m.creator_id, COALESCE(m.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid))
    ))
  )
$$;

CREATE OR REPLACE FUNCTION public.game_chat_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.user_id AND banned) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  IF (SELECT count(*) FROM public.game_chat_messages WHERE user_id = NEW.user_id AND created_at > now() - interval '10 seconds') >= 5 THEN
    RAISE EXCEPTION 'You are sending messages too fast';
  END IF;
  NEW.body := btrim(NEW.body);
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER game_chat_guard BEFORE INSERT ON public.game_chat_messages FOR EACH ROW EXECUTE FUNCTION public.game_chat_guard();

CREATE POLICY "Read accessible chat rooms" ON public.game_chat_messages FOR SELECT TO authenticated USING (public.can_access_chat_room(room));
CREATE POLICY "Post in accessible chat rooms" ON public.game_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.can_access_chat_room(room));
CREATE POLICY "Admins delete chat" ON public.game_chat_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_chat_messages;