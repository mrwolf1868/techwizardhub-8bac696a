CREATE OR REPLACE FUNCTION public.admin_cancel_match(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE m game_matches;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO m FROM game_matches WHERE id=_id FOR UPDATE;
  IF m.id IS NULL OR m.status NOT IN ('waiting','active') THEN RAISE EXCEPTION 'Match is already closed'; END IF;
  UPDATE profiles SET coins=coins+m.stake WHERE user_id IN (m.creator_id, m.opponent_id);
  INSERT INTO transactions(user_id,type,amount,description)
    SELECT u, 'game', m.stake, 'Match cancelled by admin — stake refunded'
    FROM unnest(ARRAY[m.creator_id, m.opponent_id]) u WHERE u IS NOT NULL;
  UPDATE game_matches SET status='cancelled', updated_at=now() WHERE id=_id;
END $function$;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_match(uuid) TO authenticated;