ALTER TABLE public.wallet_withdrawals ADD COLUMN IF NOT EXISTS fee integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.withdrawal_fee(_amount integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT CASE WHEN _amount IS NULL OR _amount <= 0 THEN 0 ELSE CEIL(_amount * 0.02)::integer END $$;

CREATE OR REPLACE FUNCTION public.payout_reserve_wallet(_uid uuid, _amount integer, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _min integer; _max integer; _fee integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _min := GREATEST(1, public.setting_int('wallet_limits', 'min_withdraw', 10));
  _max := LEAST(150000, public.setting_int('wallet_limits', 'max_withdraw', 150000));
  IF _amount IS NULL OR _amount < _min OR _amount > _max THEN RAISE EXCEPTION 'Withdrawals must be from KSh % to KSh %', _min, _max; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND banned) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  _fee := public.withdrawal_fee(_amount);
  UPDATE public.profiles SET coins = coins - (_amount + _fee), last_active = now(), updated_at = now() WHERE user_id = _uid AND coins >= _amount + _fee;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance (KSh % plus 2%% fee KSh %)', _amount, _fee; END IF;
  INSERT INTO public.wallet_withdrawals (user_id, phone, amount, fee) VALUES (_uid, _phone, _amount, _fee) RETURNING id INTO _id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'withdrawal', -_amount, 'M-Pesa withdrawal to ' || _phone);
  IF _fee > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'withdrawal_fee', -_fee, 'Withdrawal fee (2%)');
  END IF;
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_uid, _uid, 'withdrawal_request', 'Requested KSh ' || _amount || ' (+' || _fee || ' fee) to ' || _phone);
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payout_reserve_profit(_uid uuid, _amount integer, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _fees bigint; _withdrawn bigint; _id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _amount IS NULL OR _amount < 10 OR _amount > 150000 THEN RAISE EXCEPTION 'Enter an amount from 10 to 150,000'; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  PERFORM 1 FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0)::bigint INTO _fees FROM public.transactions WHERE user_id = _uid AND type = 'house_fee';
  SELECT COALESCE(SUM(amount), 0)::bigint INTO _withdrawn FROM public.admin_profit_withdrawals WHERE created_by = _uid AND status IN ('processing', 'paid');
  IF _amount::bigint > _fees - _withdrawn THEN RAISE EXCEPTION 'Withdrawal exceeds available profit'; END IF;
  INSERT INTO public.admin_profit_withdrawals (created_by, phone, amount, status) VALUES (_uid, _phone, _amount, 'processing') RETURNING id INTO _id;
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_uid, _uid, 'profit_withdrawal', 'Started KSh ' || _amount || ' payout to ' || _phone);
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payout_complete(_kind text, _id uuid, _conversation_id text, _originator_id text, _success boolean, _receipt text, _desc text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w public.wallet_withdrawals; p public.admin_profit_withdrawals; adm uuid;
BEGIN
  IF _kind IS NULL OR _kind = 'wallet' THEN
    SELECT * INTO w FROM public.wallet_withdrawals
      WHERE (_id IS NOT NULL AND id = _id)
         OR (_id IS NULL AND ((_conversation_id IS NOT NULL AND conversation_id = _conversation_id) OR (_originator_id IS NOT NULL AND originator_conversation_id = _originator_id)))
      LIMIT 1 FOR UPDATE;
    IF w.id IS NOT NULL THEN
      IF w.status NOT IN ('pending', 'processing') THEN RETURN 'already_final'; END IF;
      IF _success THEN
        UPDATE public.wallet_withdrawals SET status = 'paid', mpesa_receipt = _receipt, result_desc = _desc, processed_at = now() WHERE id = w.id;
        IF w.fee > 0 THEN
          SELECT user_id INTO adm FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
          IF adm IS NOT NULL THEN
            INSERT INTO public.transactions (user_id, type, amount, description) VALUES (adm, 'house_fee', w.fee, 'Withdrawal fee (2%)');
          END IF;
        END IF;
      ELSE
        UPDATE public.wallet_withdrawals SET status = 'failed', result_desc = _desc, processed_at = now() WHERE id = w.id;
        UPDATE public.profiles SET coins = coins + w.amount + w.fee, updated_at = now() WHERE user_id = w.user_id;
        INSERT INTO public.transactions (user_id, type, amount, description) VALUES (w.user_id, 'withdrawal_refund', w.amount + w.fee, 'Withdrawal failed — amount and fee returned');
      END IF;
      RETURN 'wallet';
    END IF;
  END IF;
  IF _kind IS NULL OR _kind = 'profit' THEN
    SELECT * INTO p FROM public.admin_profit_withdrawals
      WHERE (_id IS NOT NULL AND id = _id)
         OR (_id IS NULL AND ((_conversation_id IS NOT NULL AND conversation_id = _conversation_id) OR (_originator_id IS NOT NULL AND originator_conversation_id = _originator_id)))
      LIMIT 1 FOR UPDATE;
    IF p.id IS NOT NULL THEN
      IF p.status <> 'processing' THEN RETURN 'already_final'; END IF;
      IF _success THEN
        UPDATE public.admin_profit_withdrawals SET status = 'paid', mpesa_receipt = _receipt, result_desc = _desc, processed_at = now() WHERE id = p.id;
      ELSE
        UPDATE public.admin_profit_withdrawals SET status = 'failed', result_desc = _desc, processed_at = now() WHERE id = p.id;
      END IF;
      RETURN 'profit';
    END IF;
  END IF;
  RETURN 'not_found';
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_resolve_wallet_withdrawal(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w public.wallet_withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _status <> 'rejected' THEN RAISE EXCEPTION 'Payouts are confirmed by the payout provider only'; END IF;
  SELECT * INTO w FROM public.wallet_withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status <> 'pending' THEN RAISE EXCEPTION 'Only requests not yet sent can be rejected'; END IF;
  UPDATE public.wallet_withdrawals SET status = 'rejected', processed_by = auth.uid(), processed_at = now() WHERE id = _id;
  UPDATE public.profiles SET coins = coins + w.amount + w.fee, updated_at = now() WHERE user_id = w.user_id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (w.user_id, 'withdrawal_refund', w.amount + w.fee, 'Withdrawal rejected — amount and fee returned');
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (w.user_id, auth.uid(), 'withdrawal_rejected', 'Rejected KSh ' || w.amount);
END;
$function$;

CREATE OR REPLACE FUNCTION public.game_charge_entry(_uid uuid, _stake integer, _game text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE fee int := public.game_entry_fee(_stake); adm uuid;
BEGIN
  UPDATE profiles SET coins = coins - (_stake + fee) WHERE user_id=_uid AND coins >= _stake + fee;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance (stake % + entry fee %)', _stake, fee; END IF;
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_uid,'game',-_stake, initcap(_game)||' stake');
  INSERT INTO transactions(user_id,type,amount,description) VALUES (_uid,'game',-fee, initcap(_game)||' entry fee (5%)');
  SELECT user_id INTO adm FROM user_roles WHERE role='admin' ORDER BY created_at LIMIT 1;
  IF adm IS NOT NULL AND fee > 0 THEN
    INSERT INTO transactions(user_id,type,amount,description) VALUES (adm,'house_fee',fee, initcap(_game)||' entry fee');
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_coins(_user_id uuid, _balance integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _old integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _user_id IS NULL OR _balance IS NULL OR _balance < 0 OR _balance > 10000000 THEN RAISE EXCEPTION 'Enter a balance from 0 to 10,000,000'; END IF;
  SELECT coins INTO _old FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User wallet not found'; END IF;
  IF _old = _balance THEN RETURN; END IF;
  UPDATE public.profiles SET coins = _balance, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_user_id, 'admin_adjustment', _balance - _old, 'Balance set by admin');
  INSERT INTO public.activity_logs (user_id, actor_id, event, detail) VALUES (_user_id, auth.uid(), 'balance_set', 'Admin set balance from ' || _old || ' to ' || _balance);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_set_user_coins(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_coins(uuid, integer) TO authenticated;

CREATE TABLE IF NOT EXISTS public.balance_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  previous_coins integer NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.balance_resets TO authenticated;
GRANT ALL ON public.balance_resets TO service_role;
ALTER TABLE public.balance_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read balance resets" ON public.balance_resets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rules_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL CHECK (game IN ('chess','draughts','tictactoe','connect4')),
  question_key text NOT NULL CHECK (char_length(question_key) BETWEEN 3 AND 300),
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 300),
  answer text NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_asked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game, question_key)
);
GRANT ALL ON public.rules_answers TO service_role;
ALTER TABLE public.rules_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone read public settings" ON public.admin_settings;
CREATE POLICY "Anyone read public settings" ON public.admin_settings FOR SELECT
USING (((key <> ALL (ARRAY['mpesa_consumer_key','mpesa_consumer_secret','mpesa_passkey'])) AND (key !~~ 'mpesa_b2c_%') AND (key !~~ 'mullahc_%')) OR public.has_role(auth.uid(), 'admin'::public.app_role));