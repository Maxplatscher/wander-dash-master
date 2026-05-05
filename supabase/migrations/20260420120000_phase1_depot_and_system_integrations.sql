-- Phase 1: Depot + Systemintegrationen (verschluesselte Zugangsdaten)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypted payload for access credentials.
-- The encryption key is loaded from Supabase Vault:
--   vault.decrypted_secrets.name = 'integration_encryption_key'
CREATE OR REPLACE FUNCTION public.encrypt_integration_secret(plain_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
BEGIN
  SELECT decrypted_secret
  INTO _key
  FROM vault.decrypted_secrets
  WHERE name = 'integration_encryption_key'
  LIMIT 1;

  IF _key IS NULL OR length(_key) = 0 THEN
    RAISE EXCEPTION 'Missing vault secret integration_encryption_key';
  END IF;

  RETURN encode(pgp_sym_encrypt(plain_text, _key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_integration_secret(cipher_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
BEGIN
  SELECT decrypted_secret
  INTO _key
  FROM vault.decrypted_secrets
  WHERE name = 'integration_encryption_key'
  LIMIT 1;

  IF _key IS NULL OR length(_key) = 0 THEN
    RAISE EXCEPTION 'Missing vault secret integration_encryption_key';
  END IF;

  IF cipher_text IS NULL OR length(cipher_text) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(decode(cipher_text, 'base64'), _key);
END;
$$;

CREATE TABLE public.depot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'DE',
  timezone TEXT DEFAULT 'Europe/Berlin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX depot_company_id_name_key
  ON public.depot (company_id, name);
CREATE INDEX idx_depot_company_id ON public.depot (company_id);
CREATE INDEX idx_depot_active ON public.depot (company_id, is_active);

ALTER TABLE public.depot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own depots"
ON public.depot
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage own depots"
ON public.depot
FOR ALL TO authenticated
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());

CREATE TABLE public.system_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  depot_id UUID REFERENCES public.depot(id) ON DELETE CASCADE,
  system_key TEXT NOT NULL,
  display_name TEXT,
  base_url TEXT,
  username TEXT,
  secret_ciphertext TEXT,
  access_token_ciphertext TEXT,
  refresh_token_ciphertext TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT system_integrations_scope_key_unique UNIQUE (company_id, depot_id, system_key)
);

CREATE INDEX idx_system_integrations_company_id
  ON public.system_integrations (company_id);
CREATE INDEX idx_system_integrations_depot_id
  ON public.system_integrations (depot_id);
CREATE INDEX idx_system_integrations_active
  ON public.system_integrations (company_id, is_active);

ALTER TABLE public.system_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own system integrations"
ON public.system_integrations
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage own system integrations"
ON public.system_integrations
FOR ALL TO authenticated
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_depot_updated_at ON public.depot;
CREATE TRIGGER trg_depot_updated_at
BEFORE UPDATE ON public.depot
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_system_integrations_updated_at ON public.system_integrations;
CREATE TRIGGER trg_system_integrations_updated_at
BEFORE UPDATE ON public.system_integrations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
