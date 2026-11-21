CREATE TABLE public.game_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type text NOT NULL CHECK (game_type IN ('chess','draughts')),
  stake integer NOT NULL CHECK (stake > 0 AND stake <= 100000),
  creator_id uuid NOT NULL,
  opponent_id uuid,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished','cancelled')),
  state text,
  turn uuid,
  winner_id uuid,
  house_fee integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_matches TO authenticated;
GRANT ALL ON public.game_matches TO service_role;
ALTER TABLE public.game_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View open or own matches" ON public.game_matches FOR SELECT TO authenticated
USING (status = 'waiting' OR auth.uid() IN (creator_id, opponent_id) OR has_role(auth.uid(),'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_matches;

CREATE OR REPLACE FUNCTION public.game_create_match(_game text, _stake int, _state text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  UPDATE profiles SET coins = coins - _stake WHERE user_id=_uid AND coins >= _stake;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO game_matches(game_type, stake, creator_id, state, turn)
  VALUES (_game, _stake, _uid, _state, _uid) RETURNING id INTO _id;
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_uid,'game',-_stake, initcap(_game)||' stake');
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.game_join_match(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m game_matches; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'waiting' THEN RAISE EXCEPTION 'Match not available'; END IF;
  IF m.creator_id = _uid THEN RAISE EXCEPTION 'Cannot join your own match'; END IF;
  UPDATE profiles SET coins = coins - m.stake WHERE user_id=_uid AND coins >= m.stake;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE game_matches SET opponent_id=_uid, status='active', updated_at=now() WHERE id=_id;
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_uid,'game',-m.stake, initcap(m.game_type)||' stake');
END $$;

CREATE OR REPLACE FUNCTION public.game_settle(_id uuid, _winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m game_matches; pot int; fee int; adm uuid;
BEGIN
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  pot := m.stake * 2;
  IF _winner IS NULL THEN
    UPDATE profiles SET coins=coins+m.stake WHERE user_id IN (m.creator_id, m.opponent_id);
    UPDATE game_matches SET status='finished', updated_at=now() WHERE id=_id;
    RETURN;
  END IF;
  fee := ceil(pot * 0.05);
  UPDATE profiles SET coins=coins+(pot-fee) WHERE user_id=_winner;
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_winner,'game',pot-fee, initcap(m.game_type)||' win');
  SELECT user_id INTO adm FROM user_roles WHERE role='admin' ORDER BY created_at LIMIT 1;
  IF adm IS NOT NULL THEN
    UPDATE profiles SET coins=coins+fee WHERE user_id=adm;
    INSERT INTO transactions(user_id,type,amount,description) VALUES (adm,'house_fee',fee, initcap(m.game_type)||' 5% fee');
  END IF;
  UPDATE game_matches SET status='finished', winner_id=_winner, house_fee=fee, updated_at=now() WHERE id=_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.game_settle(uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.game_move(_id uuid, _state text, _result text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m game_matches; _uid uuid := auth.uid(); other uuid;
BEGIN
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  IF m.status <> 'active' OR m.turn <> _uid THEN RAISE EXCEPTION 'Not your turn'; END IF;
  other := CASE WHEN _uid=m.creator_id THEN m.opponent_id ELSE m.creator_id END;
  UPDATE game_matches SET state=_state, turn=other, updated_at=now() WHERE id=_id;
  IF _result = 'win' THEN PERFORM game_settle(_id, _uid);
  ELSIF _result = 'draw' THEN PERFORM game_settle(_id, NULL); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.game_resign(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m game_matches; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  IF _uid NOT IN (m.creator_id, coalesce(m.opponent_id,'00000000-0000-0000-0000-000000000000')) THEN RAISE EXCEPTION 'Not your match'; END IF;
  IF m.status='waiting' THEN
    UPDATE profiles SET coins=coins+m.stake WHERE user_id=_uid;
    INSERT INTO transactions(user_id,type,amount,description) VALUES (_uid,'game',m.stake,'Match cancelled refund');
    UPDATE game_matches SET status='cancelled', updated_at=now() WHERE id=_id;
  ELSIF m.status='active' THEN
    PERFORM game_settle(_id, CASE WHEN _uid=m.creator_id THEN m.opponent_id ELSE m.creator_id END);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.game_create_match(text,int,text), public.game_join_match(uuid), public.game_move(uuid,text,text), public.game_resign(uuid) TO authenticated;