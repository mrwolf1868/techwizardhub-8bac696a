REVOKE EXECUTE ON FUNCTION public.game_create_match(text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.setting_int(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.game_is_locked(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setting_int(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_is_locked(text) TO service_role;