DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.game_join_match(uuid)'::regprocedure) INTO d;
 d:=replace(d,'public.game_join_match(_id uuid)','public.join_match_checked(_id uuid, _code text)');
 d:=replace(d,'IF m.opponent_id IS NOT NULL','IF m.match_mode = ''friend'' AND (_code IS NULL OR upper(trim(_code)) IS DISTINCT FROM m.invite_code) THEN RAISE EXCEPTION ''Enter the friend code to join this match''; END IF; IF m.opponent_id IS NOT NULL');
 EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public.join_match_checked(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.join_match_checked(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.game_join_match(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.join_match_checked(_id,NULL); END $$;
CREATE OR REPLACE FUNCTION public.game_join_match_by_code(_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE _id uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 IF _code IS NULL OR upper(trim(_code)) !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'Enter a valid 6-character friend code'; END IF;
 SELECT id INTO _id FROM public.game_matches WHERE match_mode='friend' AND status='waiting' AND invite_code=upper(trim(_code)) FOR UPDATE;
 IF _id IS NULL THEN RAISE EXCEPTION 'Friend match not found or already joined'; END IF;
 PERFORM public.join_match_checked(_id,_code); RETURN _id; END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.confirm_stk_deposit(text,boolean,text,text)'::regprocedure) INTO d;
 d:=replace(d,'(t.user_id IS NULL OR _receipt IS NULL OR length(_receipt)<5)','(t.user_id IS NULL)');
 EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public.game_join_match(uuid), public.game_join_match_by_code(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.game_join_match(uuid),public.game_join_match_by_code(text) TO authenticated,service_role;
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.join_match_checked(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Private join helper must not be callable directly'; END IF;
 IF NOT position('Enter the friend code' in pg_get_functiondef('public.join_match_checked(uuid,text)'::regprocedure))>0 THEN RAISE EXCEPTION 'Private joins require a code'; END IF;
END $$;