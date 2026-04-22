
CREATE TABLE public.mpesa_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  amount INTEGER NOT NULL,
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  mpesa_receipt TEXT,
  result_desc TEXT,
  client_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mpesa_checkout ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_client ON public.mpesa_transactions(client_id);

ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (payment initiation is public)
CREATE POLICY "Anyone can create payment requests"
ON public.mpesa_transactions
FOR INSERT
WITH CHECK (true);

-- Anyone can read transactions (needed for polling status from client)
CREATE POLICY "Anyone can read transactions"
ON public.mpesa_transactions
FOR SELECT
USING (true);

-- Updates only via service role (callback edge function)
-- No update policy = blocked for anon/authenticated; service_role bypasses RLS

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_mpesa_transactions_updated_at
BEFORE UPDATE ON public.mpesa_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
