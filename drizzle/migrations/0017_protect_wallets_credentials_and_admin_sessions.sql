CREATE TABLE public.admin_access_sessions (session_id text PRIMARY KEY, user_id uuid NOT NULL, expires_at timestamptz NOT NULL);
GRANT ALL ON public.admin_access_sessions TO service_role;
ALTER TABLE public.admin_access_sessions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.admin_access_verified() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.admin_access_sessions WHERE user_id=auth.uid() AND session_id=auth.jwt()->>'session_id' AND expires_at>now()) $$;
REVOKE ALL ON FUNCTION public.admin_access_verified() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_access_verified() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.auto_grant_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.auto_grant_admin() FROM PUBLIC,anon,authenticated;
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (last_active) ON public.profiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transfer_tokens FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_usage FROM authenticated;
REVOKE INSERT ON public.pairing_logs FROM authenticated;
DROP POLICY IF EXISTS "Anyone insert pairing logs" ON public.pairing_logs;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own tx" ON public.transactions;
DROP POLICY IF EXISTS "Users insert own tokens" ON public.transfer_tokens;
DROP POLICY IF EXISTS "Users insert own usage" ON public.service_usage;
DROP POLICY IF EXISTS "Users update own usage" ON public.service_usage;
DO $$ DECLARE r record; q text; w text; BEGIN
 FOR r IN SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname='public' AND (qual LIKE '%has_role(auth.uid(), ''admin''::app_role)%' OR with_check LIKE '%has_role(auth.uid(), ''admin''::app_role)%') AND tablename<>'admin_settings' LOOP
 q:=replace(r.qual,'has_role(auth.uid(), ''admin''::app_role)','public.admin_access_verified()'); w:=replace(r.with_check,'has_role(auth.uid(), ''admin''::app_role)','public.admin_access_verified()');
 EXECUTE format('ALTER POLICY %I ON public.%I%s%s',r.policyname,r.tablename,CASE WHEN q IS NULL THEN '' ELSE ' USING ('||q||')' END,CASE WHEN w IS NULL THEN '' ELSE ' WITH CHECK ('||w||')' END);
 END LOOP;
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',r.tablename); END LOOP;
END $$;
DROP POLICY IF EXISTS "Admins manage settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anyone read public settings" ON public.admin_settings;
CREATE POLICY "Read non-secret site configuration" ON public.admin_settings FOR SELECT TO authenticated USING (key IN ('locked_games','stake_limits','wallet_limits','site_announcement','mpesa_shortcode','mpesa_till','mpesa_env','mullahc_env','max_pairing_attempts_per_hour','max_sessions','anti_spam'));
CREATE POLICY "Verified admins edit non-secret settings" ON public.admin_settings FOR ALL TO authenticated USING (public.admin_access_verified() AND key IN ('locked_games','stake_limits','wallet_limits','site_announcement','mpesa_shortcode','mpesa_till','mpesa_env','mullahc_env','max_pairing_attempts_per_hour','max_sessions','anti_spam')) WITH CHECK (public.admin_access_verified() AND key IN ('locked_games','stake_limits','wallet_limits','site_announcement','mpesa_shortcode','mpesa_till','mpesa_env','mullahc_env','max_pairing_attempts_per_hour','max_sessions','anti_spam'));
DO $$ DECLARE r record; d text; BEGIN
 FOR r IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('admin_adjust_user_coins','admin_cancel_match','admin_get_profit_summary','admin_resolve_wallet_withdrawal','admin_set_user_banned','admin_set_user_coins') LOOP
 d:=r.def; d:=replace(d,'BEGIN','BEGIN IF NOT public.admin_access_verified() THEN RAISE EXCEPTION ''Verify your admin password first''; END IF;'); EXECUTE d;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.confirm_stk_deposit(_checkout text,_success boolean,_receipt text,_description text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t public.mpesa_transactions; BEGIN
 SELECT * INTO t FROM public.mpesa_transactions WHERE checkout_request_id=_checkout FOR UPDATE;
 IF t.id IS NULL THEN RETURN 'not_found'; END IF;
 IF t.status<>'pending' OR t.coins_credited THEN RETURN 'already_final'; END IF;
 IF _success AND (t.user_id IS NULL OR _receipt IS NULL OR length(_receipt)<5) THEN RAISE EXCEPTION 'Missing confirmation'; END IF;
 IF _success THEN
 UPDATE public.profiles SET coins=coins+t.amount,updated_at=now() WHERE user_id=t.user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
 INSERT INTO public.transactions(user_id,type,amount,description) VALUES(t.user_id,'purchase',t.amount,'M-Pesa deposit confirmed');
 END IF;
 UPDATE public.mpesa_transactions SET status=CASE WHEN _success THEN 'success' ELSE 'failed' END,coins_credited=_success,mpesa_receipt=_receipt,result_desc=left(_description,255),updated_at=now() WHERE id=t.id;
 RETURN 'confirmed'; END $$;
REVOKE ALL ON FUNCTION public.confirm_stk_deposit(text,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stk_deposit(text,boolean,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.charge_service_continuation(_uid uuid,_slug text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.child_projects; b integer; BEGIN
 SELECT * INTO c FROM public.child_projects WHERE slug=_slug AND enabled;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Service unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_uid AND banned) THEN RAISE EXCEPTION 'Account restricted'; END IF;
 UPDATE public.profiles SET coins=coins-c.continuation_price_coins,updated_at=now() WHERE user_id=_uid AND coins>=c.continuation_price_coins RETURNING coins INTO b;
 IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
 IF c.continuation_price_coins>0 THEN INSERT INTO public.transactions(user_id,type,amount,description) VALUES(_uid,'service',-c.continuation_price_coins,'Continue: '||c.name); END IF;
 RETURN b; END $$;
REVOKE ALL ON FUNCTION public.charge_service_continuation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charge_service_continuation(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.game_move(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.game_move(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_verified_game_move(_id uuid,_uid uuid,_previous text,_next text,_result text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE m public.game_matches; BEGIN
 SELECT * INTO m FROM public.game_matches WHERE id=_id FOR UPDATE;
 IF m.id IS NULL OR m.status<>'active' OR m.turn IS DISTINCT FROM _uid OR _uid NOT IN(m.creator_id,m.opponent_id) THEN RAISE EXCEPTION 'Not your turn'; END IF;
 IF m.state IS DISTINCT FROM _previous THEN RAISE EXCEPTION 'Board changed. Try again'; END IF;
 IF m.game_type='quiz' THEN RAISE EXCEPTION 'Use quiz submission'; END IF;
 UPDATE public.game_matches SET state=_next,turn=CASE WHEN _uid=m.creator_id THEN m.opponent_id ELSE m.creator_id END,updated_at=now() WHERE id=_id;
 IF _result='win' THEN PERFORM public.game_settle(_id,_uid); ELSIF _result='draw' THEN PERFORM public.game_settle(_id,NULL); END IF;
 END $$;
REVOKE ALL ON FUNCTION public.apply_verified_game_move(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_game_move(uuid,uuid,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.canonical_match_start() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE s text:=''; r integer; c integer; BEGIN
 IF NEW.game_type='chess' THEN NEW.state:='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 ELSIF NEW.game_type='draughts' THEN FOR r IN 0..7 LOOP FOR c IN 0..7 LOOP s:=s||CASE WHEN (r+c)%2=1 AND r<3 THEN 'b' WHEN (r+c)%2=1 AND r>4 THEN 'w' ELSE '.' END; END LOOP; END LOOP; NEW.state:=s;
 ELSIF NEW.game_type='tictactoe' THEN NEW.state:=repeat('.',9); ELSIF NEW.game_type='connect4' THEN NEW.state:=repeat('.',42); END IF; RETURN NEW; END $$;
CREATE TRIGGER canonical_match_start BEFORE INSERT ON public.game_matches FOR EACH ROW EXECUTE FUNCTION public.canonical_match_start();
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.profiles','INSERT') OR has_column_privilege('authenticated','public.profiles','coins','UPDATE') THEN RAISE EXCEPTION 'Financial profile writes must be server-only'; END IF;
 IF has_table_privilege('authenticated','public.transactions','INSERT') THEN RAISE EXCEPTION 'Ledger writes must be server-only'; END IF;
 IF has_function_privilege('authenticated','public.game_move(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Unvalidated moves must be server-only'; END IF;
 IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) THEN RAISE EXCEPTION 'Every application table must have RLS'; END IF;
END $$;