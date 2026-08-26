-- get_my_role() nahm bisher LIMIT 1 ohne ORDER BY. Bei zwei Rollen pro User
-- war das Ergebnis zufaellig. Enum-Reihenfolge admin < dispatcher < driver
-- macht die Wahl deterministisch (hoehere Berechtigung zuerst).
-- Weiterhin gilt: ein User soll nur eine Rolle haben; das ORDER BY ist der
-- Sicherheitsnetz, kein Freibrief fuer Doppelrollen.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY role ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
