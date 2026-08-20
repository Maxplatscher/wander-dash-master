-- Align the legacy integration table with the schema used by the frontend
-- and the upsert-integration, test-integration and research-article functions.

ALTER TABLE public.system_integrations
  ADD COLUMN IF NOT EXISTS system_type TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS config JSONB,
  ADD COLUMN IF NOT EXISTS vault_secret_id UUID,
  ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_test_result BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_test_message TEXT,
  ADD COLUMN IF NOT EXISTS last_test_latency_ms INTEGER;

-- Preserve any legacy rows before removing obsolete columns.
UPDATE public.system_integrations
SET
  system_type = COALESCE(
    system_type,
    CASE
      WHEN metadata->>'system_type' IN (
        'erp',
        'telematics',
        'email_imap',
        'rest_api',
        'csv_import',
        'research_source'
      )
      THEN metadata->>'system_type'
      WHEN system_key IN (
        'erp',
        'telematics',
        'email_imap',
        'rest_api',
        'csv_import',
        'research_source'
      )
      THEN system_key
      ELSE 'rest_api'
    END
  ),
  name = COALESCE(
    name,
    NULLIF(display_name, ''),
    NULLIF(system_key, ''),
    id::TEXT
  ),
  config = COALESCE(config, metadata->'config', '{}'::JSONB)
    || CASE
      WHEN base_url IS NOT NULL AND base_url <> ''
      THEN jsonb_build_object('base_url', base_url)
      ELSE '{}'::JSONB
    END;

ALTER TABLE public.system_integrations
  ALTER COLUMN system_type SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN config SET DEFAULT '{}'::JSONB,
  ALTER COLUMN config SET NOT NULL;

ALTER TABLE public.system_integrations
  DROP CONSTRAINT IF EXISTS system_integrations_scope_key_unique,
  DROP COLUMN IF EXISTS system_key,
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS base_url,
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS token_expires_at,
  DROP COLUMN IF EXISTS last_sync_at,
  DROP COLUMN IF EXISTS metadata;

CREATE OR REPLACE FUNCTION public.delete_integration_with_secret(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_company_id UUID;
  v_secret_id UUID;
BEGIN
  v_company_id := public.get_user_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Keine company_id für aktuellen User gefunden';
  END IF;

  DELETE FROM public.system_integrations
  WHERE id = p_id
    AND company_id = v_company_id
  RETURNING vault_secret_id INTO v_secret_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integration nicht gefunden oder keine Berechtigung';
  END IF;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_integration_with_secret(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_integration_with_secret(UUID)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
