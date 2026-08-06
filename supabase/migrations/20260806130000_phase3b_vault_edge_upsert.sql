-- Phase 3B: Vault via Edge Functions — keine Klartext-Credentials mehr über RPC

-- Drop known overloads so we don't leave a live plaintext upsert beside the stub
DROP FUNCTION IF EXISTS public.upsert_integration(uuid, uuid, uuid, text, text, jsonb, text, boolean);
DROP FUNCTION IF EXISTS public.upsert_integration(uuid, uuid, uuid, text, text, json, text, boolean);

-- 1) Service-role-only Vault-Helper (kein Zugriff für authenticated/anon)
CREATE OR REPLACE FUNCTION public.create_integration_vault_secret(
  p_secret text,
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RAISE EXCEPTION 'p_secret must not be empty';
  END IF;
  RETURN vault.create_secret(p_secret, p_name, p_description);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_integration_vault_secret(
  p_secret_id uuid,
  p_secret text,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF p_secret_id IS NULL THEN
    RAISE EXCEPTION 'p_secret_id required';
  END IF;
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RAISE EXCEPTION 'p_secret must not be empty';
  END IF;
  PERFORM vault.update_secret(p_secret_id, p_secret, p_name, p_description);
END;
$$;

REVOKE ALL ON FUNCTION public.create_integration_vault_secret(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_integration_vault_secret(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_integration_vault_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_integration_vault_secret(uuid, text, text, text) TO service_role;

-- 2) Alten Klartext-Pfad sperren (Edge Function ist der einzige Schreibweg für Credentials)
CREATE OR REPLACE FUNCTION public.upsert_integration(
  p_id uuid,
  p_company_id uuid,
  p_depot_id uuid,
  p_system_type text,
  p_name text,
  p_config jsonb,
  p_credentials text,
  p_is_active boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'upsert_integration is deprecated. Use Edge Function upsert-integration (Vault). Credentials must not be written via RPC.';
END;
$$;

-- Keep signature callable for typegen, but revoke from clients
REVOKE ALL ON FUNCTION public.upsert_integration(uuid, uuid, uuid, text, text, jsonb, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_integration(uuid, uuid, uuid, text, text, jsonb, text, boolean)
  TO service_role;

-- 3) Übergangsspalten entfernen (falls noch vorhanden)
ALTER TABLE public.system_integrations
  DROP COLUMN IF EXISTS credentials_enc,
  DROP COLUMN IF EXISTS secret_ciphertext,
  DROP COLUMN IF EXISTS access_token_ciphertext,
  DROP COLUMN IF EXISTS refresh_token_ciphertext;
