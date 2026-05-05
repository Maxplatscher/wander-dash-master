-- Phase 3: Integrationstest + Vault-Cleanup

ALTER TABLE public.system_integrations
  ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_test_result BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_test_message TEXT,
  ADD COLUMN IF NOT EXISTS last_test_latency_ms INTEGER;

CREATE OR REPLACE FUNCTION public.delete_integration_with_secret(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_secret_id UUID;
BEGIN
  v_company_id := public.get_user_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Keine company_id für aktuellen User gefunden';
  END IF;

  SELECT vault_secret_id
  INTO v_secret_id
  FROM public.system_integrations
  WHERE id = p_id
    AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integration nicht gefunden oder keine Berechtigung';
  END IF;

  DELETE FROM public.system_integrations
  WHERE id = p_id
    AND company_id = v_company_id;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets
    WHERE id = v_secret_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_integration_with_secret(UUID) TO authenticated;
