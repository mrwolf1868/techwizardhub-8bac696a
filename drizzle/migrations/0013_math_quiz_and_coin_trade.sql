ALTER TABLE public.game_matches DROP CONSTRAINT game_matches_game_type_check;
ALTER TABLE public.game_matches ADD CONSTRAINT game_matches_game_type_check CHECK (game_type = ANY (ARRAY['chess','draughts','tictactoe','connect4','quiz']));

CREATE OR REPLACE FUNCTION public.quiz_prepare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE qs jsonb;
BEGIN
  IF NEW.game_type <> 'quiz' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.state := '{}'; RETURN NEW; END IF;
  IF OLD.status = 'waiting' AND NEW.status = 'active' THEN
    SELECT jsonb_agg(q) INTO qs FROM (
      SELECT CASE r.k WHEN 0 THEN jsonb_build_array(r.x, '+', r.x2)
                      WHEN 1 THEN jsonb_build_array(r.x + r.x2, '-', r.x2)
                      ELSE jsonb_build_array(r.y, 'x', r.z) END AS q
      FROM generate_series(1, 10) g,
      LATERAL (SELECT floor(random() * 3 + g * 0)::int k, (10 + floor(random() * 90 + g * 0))::int x, (5 + floor(random() * 60 + g * 0))::int x2,
                      (2 + floor(random() * 11 + g * 0))::int y, (3 + floor(random() * 10 + g * 0))::int z) r
    ) s;
    NEW.state := jsonb_build_object('q', qs, 'start', extract(epoch from now()), 'r', '{}'::jsonb)::text;
    NEW.turn := NULL;
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER quiz_prepare_trg BEFORE INSERT OR UPDATE OF status ON public.game_matches FOR EACH ROW EXECUTE FUNCTION public.quiz_prepare();

CREATE OR REPLACE FUNCTION public.game_move(_id uuid, _state text, _result text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE m game_matches; _uid uuid := auth.uid(); other uuid;
BEGIN
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  IF m.game_type = 'quiz' THEN RAISE EXCEPTION 'Use the quiz answer submit'; END IF;
  IF m.status <> 'active' OR m.turn <> _uid THEN RAISE EXCEPTION 'Not your turn'; END IF;
  other := CASE WHEN _uid=m.creator_id THEN m.opponent_id ELSE m.creator_id END;
  UPDATE game_matches SET state=_state, turn=other, updated_at=now() WHERE id=_id;
  IF _result = 'win' THEN PERFORM game_settle(_id, _uid);
  ELSIF _result = 'draw' THEN PERFORM game_settle(_id, NULL); END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.quiz_decide(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE m game_matches; st jsonb; rc jsonb; ro jsonb; late boolean;
BEGIN
  SELECT * INTO m FROM game_matches WHERE id = _id FOR UPDATE;
  IF m.status <> 'active' OR m.game_type <> 'quiz' THEN RETURN; END IF;
  st := m.state::jsonb;
  rc := st->'r'->(m.creator_id::text); ro := st->'r'->(m.opponent_id::text);
  late := extract(epoch from now()) > (st->>'start')::numeric + 100;
  IF rc IS NOT NULL AND ro IS NOT NULL THEN
    IF (rc->>'s')::int > (ro->>'s')::int OR ((rc->>'s')::int = (ro->>'s')::int AND (rc->>'ms')::int < (ro->>'ms')::int) THEN PERFORM game_settle(_id, m.creator_id);
    ELSIF (rc->>'s')::int < (ro->>'s')::int OR (ro->>'ms')::int < (rc->>'ms')::int THEN PERFORM game_settle(_id, m.opponent_id);
    ELSE PERFORM game_settle(_id, NULL); END IF;
  ELSIF late THEN
    IF rc IS NOT NULL THEN PERFORM game_settle(_id, m.creator_id);
    ELSIF ro IS NOT NULL THEN PERFORM game_settle(_id, m.opponent_id);
    ELSE PERFORM game_settle(_id, NULL); END IF;
  END IF;
END $f$;

CREATE OR REPLACE FUNCTION public.quiz_submit(_id uuid, _answers integer[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE m game_matches; _uid uuid := auth.uid(); st jsonb; e jsonb; a int; b int; ans int; score int := 0; ms int;
BEGIN
  SELECT * INTO m FROM game_matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.game_type <> 'quiz' OR m.status <> 'active' THEN RAISE EXCEPTION 'Quiz not active'; END IF;
  IF _uid IS NULL OR _uid NOT IN (m.creator_id, m.opponent_id) THEN RAISE EXCEPTION 'Not your match'; END IF;
  st := m.state::jsonb;
  IF st->'r' ? _uid::text THEN RAISE EXCEPTION 'Answers already submitted'; END IF;
  FOR i IN 0..9 LOOP
    e := st->'q'->i; a := (e->>0)::int; b := (e->>2)::int;
    ans := CASE e->>1 WHEN '+' THEN a + b WHEN '-' THEN a - b ELSE a * b END;
    IF _answers IS NOT NULL AND array_length(_answers, 1) >= i + 1 AND _answers[i + 1] = ans THEN score := score + 1; END IF;
  END LOOP;
  ms := LEAST(600000, GREATEST(0, round((extract(epoch from now()) - (st->>'start')::numeric) * 1000)))::int;
  IF ms > 95000 THEN score := 0; END IF;
  st := jsonb_set(st, ARRAY['r', _uid::text], jsonb_build_object('s', score, 'ms', ms));
  UPDATE game_matches SET state = st::text, updated_at = now() WHERE id = _id;
  PERFORM quiz_decide(_id);
END $f$;

CREATE OR REPLACE FUNCTION public.quiz_finalize(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM game_matches WHERE id = _id AND auth.uid() IN (creator_id, opponent_id)) THEN RAISE EXCEPTION 'Not your match'; END IF;
  PERFORM quiz_decide(_id);
END $f$;
REVOKE ALL ON FUNCTION public.quiz_decide(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_prepare() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_submit(uuid, integer[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quiz_finalize(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_submit(uuid, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_finalize(uuid) TO authenticated;

CREATE TABLE public.coin_candles (t timestamptz PRIMARY KEY, o numeric(12,4) NOT NULL, h numeric(12,4) NOT NULL, l numeric(12,4) NOT NULL, c numeric(12,4) NOT NULL);
GRANT SELECT ON public.coin_candles TO authenticated;
GRANT ALL ON public.coin_candles TO service_role;
ALTER TABLE public.coin_candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read candles" ON public.coin_candles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.coin_market_state (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), price numeric NOT NULL, anchor numeric NOT NULL, vol numeric NOT NULL, trend numeric NOT NULL, at timestamptz NOT NULL);
GRANT ALL ON public.coin_market_state TO service_role;
ALTER TABLE public.coin_market_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.coin_market_state (price, anchor, vol, trend, at) VALUES (100, 100, 0.0006, 0, date_trunc('minute', now()) - interval '2 days');

CREATE TABLE public.coin_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  lots numeric(6,2) NOT NULL CHECK (lots >= 0.01 AND lots <= 5),
  entry numeric(12,4) NOT NULL,
  margin integer NOT NULL CHECK (margin > 0),
  sl numeric(12,4), tp numeric(12,4),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  exit_price numeric(12,4), pnl integer, close_reason text,
  opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE INDEX coin_positions_open_idx ON public.coin_positions (status) WHERE status = 'open';
CREATE INDEX coin_positions_user_idx ON public.coin_positions (user_id, opened_at DESC);
GRANT SELECT ON public.coin_positions TO authenticated;
GRANT ALL ON public.coin_positions TO service_role;
ALTER TABLE public.coin_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read positions" ON public.coin_positions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.coin_settle(_id uuid, _exit numeric, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE p coin_positions; _pnl int; adm uuid;
BEGIN
  SELECT * INTO p FROM coin_positions WHERE id = _id FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'open' THEN RETURN; END IF;
  _pnl := round((_exit - p.entry) * CASE WHEN p.side = 'buy' THEN 1 ELSE -1 END * p.lots * 1000)::int;
  _pnl := GREATEST(_pnl, -p.margin);
  UPDATE coin_positions SET status = 'closed', exit_price = _exit, pnl = _pnl, close_reason = _reason, closed_at = now() WHERE id = _id;
  IF p.margin + _pnl > 0 THEN
    UPDATE profiles SET coins = coins + p.margin + _pnl, updated_at = now() WHERE user_id = p.user_id;
  END IF;
  INSERT INTO transactions (user_id, type, amount, description) VALUES (p.user_id, 'trade', p.margin + _pnl,
    'Coin Trade ' || p.side || ' ' || p.lots || ' lot closed (' || _reason || ', P/L ' || _pnl || ')');
  SELECT user_id INTO adm FROM user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF adm IS NOT NULL AND _pnl <> 0 THEN
    UPDATE profiles SET coins = coins - _pnl, updated_at = now() WHERE user_id = adm;
    INSERT INTO transactions (user_id, type, amount, description) VALUES (adm, 'house_trade', -_pnl, 'Coin Trade house result');
  END IF;
END $f$;

CREATE OR REPLACE FUNCTION public.coin_check_positions() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE p coin_positions; px numeric; half numeric; stopout numeric; stop numeric; cd record; hit boolean;
BEGIN
  SELECT price INTO px FROM coin_market_state WHERE id = 1;
  half := px * 0.0003;
  FOR p IN SELECT * FROM coin_positions WHERE status = 'open' LOOP
    hit := false;
    IF p.side = 'buy' THEN
      stopout := p.entry - p.margin / (p.lots * 1000);
      stop := GREATEST(stopout, COALESCE(p.sl, stopout));
      FOR cd IN SELECT * FROM coin_candles WHERE t > date_trunc('minute', p.opened_at) ORDER BY t LOOP
        IF cd.l <= stop THEN PERFORM coin_settle(p.id, stop, CASE WHEN p.sl IS NOT NULL AND p.sl >= stopout THEN 'stop loss' ELSE 'stop out' END); hit := true; EXIT; END IF;
        IF p.tp IS NOT NULL AND cd.h >= p.tp THEN PERFORM coin_settle(p.id, p.tp, 'take profit'); hit := true; EXIT; END IF;
      END LOOP;
      IF NOT hit THEN
        IF px - half <= stop THEN PERFORM coin_settle(p.id, stop, CASE WHEN p.sl IS NOT NULL AND p.sl >= stopout THEN 'stop loss' ELSE 'stop out' END);
        ELSIF p.tp IS NOT NULL AND px - half >= p.tp THEN PERFORM coin_settle(p.id, p.tp, 'take profit'); END IF;
      END IF;
    ELSE
      stopout := p.entry + p.margin / (p.lots * 1000);
      stop := LEAST(stopout, COALESCE(p.sl, stopout));
      FOR cd IN SELECT * FROM coin_candles WHERE t > date_trunc('minute', p.opened_at) ORDER BY t LOOP
        IF cd.h >= stop THEN PERFORM coin_settle(p.id, stop, CASE WHEN p.sl IS NOT NULL AND p.sl <= stopout THEN 'stop loss' ELSE 'stop out' END); hit := true; EXIT; END IF;
        IF p.tp IS NOT NULL AND cd.l <= p.tp THEN PERFORM coin_settle(p.id, p.tp, 'take profit'); hit := true; EXIT; END IF;
      END LOOP;
      IF NOT hit THEN
        IF px + half >= stop THEN PERFORM coin_settle(p.id, stop, CASE WHEN p.sl IS NOT NULL AND p.sl <= stopout THEN 'stop loss' ELSE 'stop out' END);
        ELSIF p.tp IS NOT NULL AND px + half <= p.tp THEN PERFORM coin_settle(p.id, p.tp, 'take profit'); END IF;
      END IF;
    END IF;
  END LOOP;
END $f$;

CREATE OR REPLACE FUNCTION public.coin_sync() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE s coin_market_state; step interval; secs numeric; z numeric; z2 numeric; ret numeric; o numeric; mt timestamptz; sig numeric; n int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(7710042) THEN RETURN; END IF;
  SELECT * INTO s FROM coin_market_state WHERE id = 1 FOR UPDATE;
  IF s.at < now() - interval '3 days' THEN s.at := date_trunc('minute', now()) - interval '3 days'; END IF;
  WHILE s.at + interval '2 seconds' <= now() AND n < 20000 LOOP
    n := n + 1;
    step := CASE WHEN now() - s.at > interval '10 minutes' THEN interval '60 seconds' ELSE interval '2 seconds' END;
    secs := extract(epoch from step) / 2;
    IF random() < 0.002 * secs THEN s.vol := 0.0003 + random() * 0.0012; END IF;
    IF random() < 0.003 * secs THEN s.trend := (random() - 0.5) * s.vol * 0.25; END IF;
    s.anchor := s.anchor * exp((random() - 0.5) * 0.0004 * sqrt(secs));
    z := sqrt(-2 * ln(GREATEST(random(), 1e-12))) * cos(2 * pi() * random());
    z2 := abs(sqrt(-2 * ln(GREATEST(random(), 1e-12))) * cos(2 * pi() * random()));
    sig := s.vol * sqrt(secs);
    ret := s.trend * secs + 0.0015 * secs * ln(s.anchor / s.price) + sig * z;
    o := s.price;
    s.price := LEAST(500, GREATEST(20, s.price * exp(ret)));
    s.at := s.at + step;
    mt := date_trunc('minute', s.at - interval '1 millisecond');
    INSERT INTO coin_candles (t, o, h, l, c) VALUES (mt, o,
        GREATEST(o, s.price) * (1 + CASE WHEN secs > 1 THEN z2 * sig * 0.5 ELSE 0 END),
        LEAST(o, s.price) * (1 - CASE WHEN secs > 1 THEN z2 * sig * 0.5 ELSE 0 END), s.price)
      ON CONFLICT (t) DO UPDATE SET h = GREATEST(coin_candles.h, EXCLUDED.h), l = LEAST(coin_candles.l, EXCLUDED.l), c = EXCLUDED.c;
  END LOOP;
  UPDATE coin_market_state SET price = s.price, anchor = s.anchor, vol = s.vol, trend = s.trend, at = s.at WHERE id = 1;
  PERFORM coin_check_positions();
END $f$;

CREATE OR REPLACE FUNCTION public.coin_feed(_since timestamptz) RETURNS SETOF public.coin_candles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM coin_sync();
  RETURN QUERY SELECT * FROM coin_candles WHERE t >= COALESCE(_since, now() - interval '2 days') ORDER BY t LIMIT 3000;
END $f$;

CREATE OR REPLACE FUNCTION public.coin_open(_side text, _lots numeric, _sl numeric, _tp numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE _uid uuid := auth.uid(); px numeric; e numeric; mg int; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF public.game_is_locked('cointrade') THEN RAISE EXCEPTION 'Coin Trade is currently locked'; END IF;
  IF public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'The house account cannot trade'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _uid AND banned) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  IF _side NOT IN ('buy','sell') THEN RAISE EXCEPTION 'Choose buy or sell'; END IF;
  IF _lots IS NULL OR _lots < 0.01 OR _lots > 5 OR _lots <> round(_lots, 2) THEN RAISE EXCEPTION 'Lot size must be from 0.01 to 5.00'; END IF;
  IF (SELECT count(*) FROM coin_positions WHERE user_id = _uid AND status = 'open') >= 10 THEN RAISE EXCEPTION 'You can have up to 10 open trades'; END IF;
  PERFORM coin_sync();
  SELECT price INTO px FROM coin_market_state WHERE id = 1;
  e := round(CASE WHEN _side = 'buy' THEN px * 1.0003 ELSE px * 0.9997 END, 4);
  IF _side = 'buy' AND ((_sl IS NOT NULL AND _sl >= e) OR (_tp IS NOT NULL AND _tp <= e)) THEN RAISE EXCEPTION 'For a buy, stop loss must be below and take profit above the price'; END IF;
  IF _side = 'sell' AND ((_sl IS NOT NULL AND _sl <= e) OR (_tp IS NOT NULL AND _tp >= e)) THEN RAISE EXCEPTION 'For a sell, stop loss must be above and take profit below the price'; END IF;
  mg := GREATEST(1, ceil(_lots * 1000 * e / 100))::int;
  UPDATE profiles SET coins = coins - mg, last_active = now(), updated_at = now() WHERE user_id = _uid AND coins >= mg;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance: this trade needs KSh % margin', mg; END IF;
  INSERT INTO coin_positions (user_id, side, lots, entry, margin, sl, tp) VALUES (_uid, _side, _lots, e, mg, _sl, _tp) RETURNING id INTO _id;
  INSERT INTO transactions (user_id, type, amount, description) VALUES (_uid, 'trade', -mg, 'Coin Trade ' || _side || ' ' || _lots || ' lot margin');
  RETURN _id;
END $f$;

CREATE OR REPLACE FUNCTION public.coin_close(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE p coin_positions; px numeric;
BEGIN
  SELECT * INTO p FROM coin_positions WHERE id = _id;
  IF p.id IS NULL OR p.user_id <> auth.uid() THEN RAISE EXCEPTION 'Trade not found'; END IF;
  PERFORM coin_sync();
  SELECT price INTO px FROM coin_market_state WHERE id = 1;
  PERFORM coin_settle(_id, round(CASE WHEN p.side = 'buy' THEN px * 0.9997 ELSE px * 1.0003 END, 4), 'closed');
END $f$;

CREATE OR REPLACE FUNCTION public.coin_set_levels(_id uuid, _sl numeric, _tp numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE p coin_positions; px numeric;
BEGIN
  SELECT * INTO p FROM coin_positions WHERE id = _id FOR UPDATE;
  IF p.id IS NULL OR p.user_id <> auth.uid() OR p.status <> 'open' THEN RAISE EXCEPTION 'Trade not found'; END IF;
  SELECT price INTO px FROM coin_market_state WHERE id = 1;
  IF p.side = 'buy' AND ((_sl IS NOT NULL AND _sl >= px) OR (_tp IS NOT NULL AND _tp <= px)) THEN RAISE EXCEPTION 'For a buy, stop loss must be below and take profit above the price'; END IF;
  IF p.side = 'sell' AND ((_sl IS NOT NULL AND _sl <= px) OR (_tp IS NOT NULL AND _tp >= px)) THEN RAISE EXCEPTION 'For a sell, stop loss must be above and take profit below the price'; END IF;
  UPDATE coin_positions SET sl = _sl, tp = _tp WHERE id = _id;
END $f$;

REVOKE ALL ON FUNCTION public.coin_settle(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_check_positions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_feed(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coin_open(text, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coin_close(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coin_set_levels(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coin_feed(timestamptz), public.coin_open(text, numeric, numeric, numeric), public.coin_close(uuid), public.coin_set_levels(uuid, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.game_create_match_with_mode(_game text, _stake integer, _state text, _match_mode text, _opponent_id uuid DEFAULT NULL::uuid, _invite_code text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _uid uuid := auth.uid(); _coins integer; _min integer; _max integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _game NOT IN ('chess', 'draughts', 'tictactoe', 'connect4', 'quiz') THEN RAISE EXCEPTION 'Invalid game'; END IF;
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