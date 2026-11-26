CREATE OR REPLACE FUNCTION public.coin_sync() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE s coin_market_state; step interval; secs numeric; z numeric; z2 numeric; ret numeric; o numeric; mt timestamptz; sig numeric; n int := 0; _cap int := CASE WHEN auth.uid() IS NULL THEN 20000 ELSE 1200 END;
BEGIN
  IF NOT pg_try_advisory_xact_lock(7710042) THEN RETURN; END IF;
  SELECT * INTO s FROM coin_market_state WHERE id = 1 FOR UPDATE;
  IF s.at < now() - interval '3 days' THEN s.at := date_trunc('minute', now()) - interval '3 days'; END IF;
  WHILE s.at + interval '2 seconds' <= now() AND n < _cap LOOP
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
REVOKE ALL ON FUNCTION public.coin_sync() FROM PUBLIC, anon, authenticated;

SELECT public.coin_sync();