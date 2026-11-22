CREATE OR REPLACE FUNCTION public.game_entry_fee(_stake integer) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$ SELECT ceil(_stake * 0.05)::int $$;

CREATE OR REPLACE FUNCTION public.game_charge_entry(_uid uuid, _stake integer, _game text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE fee int := public.game_entry_fee(_stake); adm uuid;
BEGIN
  UPDATE profiles SET coins = coins - (_stake + fee) WHERE user_id=_uid AND coins >= _stake + fee;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance (stake % + entry fee %)', _stake, fee; END IF;
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_uid,'game',-_stake, initcap(_game)||' stake');
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_uid,'game',-fee, initcap(_game)||' entry fee (5%)');
  SELECT user_id INTO adm FROM user_roles WHERE role='admin' ORDER BY created_at LIMIT 1;
  IF adm IS NOT NULL AND fee > 0 THEN
    UPDATE profiles SET coins=coins+fee WHERE user_id=adm;
    INSERT INTO transactions(user_id,type,amount,description) VALUES (adm,'house_fee',fee, initcap(_game)||' entry fee');
  END IF;
END $function$;
REVOKE EXECUTE ON FUNCTION public.game_charge_entry(uuid,integer,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.game_create_match(_game text, _stake integer, _state text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  PERFORM public.game_charge_entry(_uid, _stake, _game);
  INSERT INTO game_matches(game_type, stake, creator_id, state, turn, house_fee)
  VALUES (_game, _stake, _uid, _state, _uid, public.game_entry_fee(_stake)) RETURNING id INTO _id;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.game_join_match(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m game_matches; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'waiting' THEN RAISE EXCEPTION 'Match not available'; END IF;
  IF m.creator_id = _uid THEN RAISE EXCEPTION 'Cannot join your own match'; END IF;
  PERFORM public.game_charge_entry(_uid, m.stake, m.game_type);
  UPDATE game_matches SET opponent_id=_uid, status='active', house_fee=house_fee+public.game_entry_fee(m.stake), updated_at=now() WHERE id=_id;
END $function$;

CREATE OR REPLACE FUNCTION public.game_settle(_id uuid, _winner uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m game_matches; pot int;
BEGIN
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'active' THEN RETURN; END IF;
  pot := m.stake * 2;
  IF _winner IS NULL THEN
    UPDATE profiles SET coins=coins+m.stake WHERE user_id IN (m.creator_id, m.opponent_id);
    INSERT INTO transactions(user_id,type,amount,description)
      SELECT u, 'game', m.stake, initcap(m.game_type)||' draw refund' FROM unnest(ARRAY[m.creator_id, m.opponent_id]) u;
    UPDATE game_matches SET status='finished', updated_at=now() WHERE id=_id;
    RETURN;
  END IF;
  IF _winner NOT IN (m.creator_id, m.opponent_id) THEN RAISE EXCEPTION 'Invalid winner'; END IF;
  UPDATE profiles SET coins=coins+pot WHERE user_id=_winner;
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_winner,'game',pot, initcap(m.game_type)||' win');
  UPDATE game_matches SET status='finished', winner_id=_winner, updated_at=now() WHERE id=_id;
END $function$;