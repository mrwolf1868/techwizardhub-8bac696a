
-- Services table: admin-defined buttons (name + url) shown to users
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view enabled services"
ON public.services FOR SELECT
TO authenticated
USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage services"
ON public.services FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: built-in WhatsApp Bot service pointing to the Deploy page
INSERT INTO public.services (name, description, url, icon, sort_order)
VALUES ('WhatsApp Bot', 'Deploy a WhatsApp pairing bot', '/deploy', 'Rocket', 0);

-- Add user_id to mpesa_transactions so server-side callback can credit the right user
ALTER TABLE public.mpesa_transactions
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS coins_credited boolean NOT NULL DEFAULT false;

-- Lock down mpesa_transactions: drop overly-permissive public policies
DROP POLICY IF EXISTS "Anyone can read transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Anyone can create payment requests" ON public.mpesa_transactions;

-- Users can only see their own transactions; admins see all
CREATE POLICY "Users view own mpesa tx"
ON public.mpesa_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Allow polling by checkout id without auth would be unsafe; client invokes edge function
-- But the Buy page polls directly. We restrict to authenticated user matching user_id.
-- Inserts are done by the edge function with service-role key which bypasses RLS,
-- so no INSERT policy is needed for clients.
