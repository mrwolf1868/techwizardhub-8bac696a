
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
    UPDATE profiles SET coins = coins + fee, updated_at = now() WHERE user_id = adm;
    INSERT INTO transactions(user_id,type,amount,description) VALUES (adm,'house_fee',fee, initcap(_game)||' entry fee');
  END IF;
END $function$;

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
  _fee := CASE WHEN public.has_role(_uid, 'admin'::public.app_role) THEN 0 ELSE public.withdrawal_fee(_amount) END;
  UPDATE public.profiles SET coins = coins - (_amount + _fee), last_active = now(), updated_at = now() WHERE user_id = _uid AND coins >= _amount + _fee;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance (KSh % plus fee KSh %)', _amount, _fee; END IF;
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
DECLARE _id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 150000 THEN RAISE EXCEPTION 'Enter an amount from 1 to 150,000'; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa phone number'; END IF;
  UPDATE public.profiles SET coins = coins - _amount, updated_at = now() WHERE user_id = _uid AND coins >= _amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal exceeds your wallet balance'; END IF;
  INSERT INTO public.admin_profit_withdrawals (created_by, phone, amount, status) VALUES (_uid, _phone, _amount, 'processing') RETURNING id INTO _id;
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (_uid, 'withdrawal', -_amount, 'Profit withdrawal to ' || _phone);
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
            UPDATE public.profiles SET coins = coins + w.fee, updated_at = now() WHERE user_id = adm;
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
        UPDATE public.profiles SET coins = coins + p.amount, updated_at = now() WHERE user_id = p.created_by;
        INSERT INTO public.transactions (user_id, type, amount, description) VALUES (p.created_by, 'withdrawal_refund', p.amount, 'Profit withdrawal failed — returned to wallet');
      END IF;
      RETURN 'profit';
    END IF;
  END IF;
  RETURN 'not_found';
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_profit_summary()
 RETURNS TABLE(total_fees bigint, total_withdrawn bigint, available bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT
      (SELECT COALESCE(SUM(t.amount), 0)::bigint FROM public.transactions t WHERE t.user_id = _uid AND t.type = 'house_fee'),
      (SELECT COALESCE(SUM(p.amount), 0)::bigint FROM public.admin_profit_withdrawals p WHERE p.created_by = _uid AND p.status IN ('processing', 'paid'))
        + (SELECT COALESCE(SUM(w.amount), 0)::bigint FROM public.wallet_withdrawals w WHERE w.user_id = _uid AND w.status IN ('pending', 'processing', 'paid')),
      (SELECT COALESCE(pr.coins, 0)::bigint FROM public.profiles pr WHERE pr.user_id = _uid);
END;
$function$;

-- One-time backfill: move earned, not-yet-withdrawn profit into the admin wallet.
WITH adm AS (SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
amt AS (
  SELECT a.user_id,
    (SELECT COALESCE(SUM(amount),0) FROM public.transactions WHERE user_id = a.user_id AND type = 'house_fee')
    - (SELECT COALESCE(SUM(amount),0) FROM public.admin_profit_withdrawals WHERE created_by = a.user_id AND status IN ('processing','paid')) AS v
  FROM adm a
), upd AS (
  UPDATE public.profiles pr SET coins = pr.coins + amt.v, updated_at = now() FROM amt WHERE pr.user_id = amt.user_id AND amt.v > 0 RETURNING pr.user_id, amt.v
)
INSERT INTO public.transactions (user_id, type, amount, description) SELECT user_id, 'admin_adjustment', v, 'Earned profit moved to wallet' FROM upd;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,20}$');

CREATE OR REPLACE FUNCTION public.set_username(_username text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _u text := btrim(_username);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _u !~ '^[A-Za-z0-9_]{3,20}$' THEN RAISE EXCEPTION 'Use 3 to 20 letters, numbers or underscores'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_u) AND user_id <> _uid) THEN RAISE EXCEPTION 'That username is taken'; END IF;
  UPDATE public.profiles SET username = _u, updated_at = now() WHERE user_id = _uid;
  RETURN _u;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_username(text) TO authenticated;
