ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS invited_user_id uuid;
CREATE INDEX IF NOT EXISTS game_matches_invited_user_waiting_idx ON public.game_matches (invited_user_id, status) WHERE invited_user_id IS NOT NULL;
DROP POLICY IF EXISTS "View open or own matches" ON public.game_matches;
CREATE POLICY "View open or own matches" ON public.game_matches FOR SELECT TO authenticated USING (((status = 'waiting') AND (match_mode = 'open')) OR (auth.uid() IN (creator_id, opponent_id, invited_user_id)) OR public.has_role(auth.uid(), 'admin'::public.app_role));

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
  INSERT INTO public.game_matches (game_type, stake, creator_id, opponent_id, invited_user_id, state, turn, house_fee, match_mode, invite_code)
  VALUES (_game, _stake, _uid, NULL, CASE WHEN _match_mode = 'challenge' THEN _opponent_id ELSE NULL END,
    _state, _uid, public.game_entry_fee(_stake), _match_mode,
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
  IF m.match_mode = 'challenge' AND m.invited_user_id IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'This invitation is for another player'; END IF;
  IF m.opponent_id IS NOT NULL THEN RAISE EXCEPTION 'Match already has an opponent'; END IF;
  PERFORM public.game_charge_entry(_uid, m.stake, m.game_type);
  UPDATE public.game_matches SET opponent_id = _uid, status = 'active', house_fee = house_fee + public.game_entry_fee(m.stake), updated_at = now() WHERE id = _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.game_join_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_join_match(uuid) TO authenticated;