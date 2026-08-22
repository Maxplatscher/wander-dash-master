-- Fahrer durften delete_integration_with_secret aufrufen: die Funktion
-- ist SECURITY DEFINER, umgeht damit die neuen Integrations-Policies
-- und pruefte bisher nur die Company, nicht die Rolle.

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
  IF auth.uid() IS NULL
     OR NOT (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'dispatcher')
     )
  THEN
    RAISE EXCEPTION 'Nur Disposition darf Integrationen löschen'
      USING ERRCODE = '42501';
  END IF;

  v_company_id := public.get_user_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Keine company_id für aktuellen User gefunden'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.system_integrations
  WHERE id = p_id
    AND company_id = v_company_id
  RETURNING vault_secret_id INTO v_secret_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integration nicht gefunden oder keine Berechtigung'
      USING ERRCODE = '42501';
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
