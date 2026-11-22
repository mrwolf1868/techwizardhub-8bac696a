REVOKE EXECUTE ON FUNCTION public.game_settle(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.game_entry_fee(integer) FROM anon;