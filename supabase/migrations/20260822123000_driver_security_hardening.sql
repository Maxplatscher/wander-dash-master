-- Block 3: Haerten der Fahrer- und Stammdatenrechte.
--
-- Grundlage sind Tests unter echter Fahreridentitaet (Rolle authenticated plus
-- JWT-Claims des Testfahrers) in zurueckgerollten Transaktionen. Behoben werden:
--   1. mutabler search_path von set_updated_at,
--   2. mandantenuebergreifendes Lesen von email_log ohne shipment_id,
--   3. Krypto-Orakel encrypt/decrypt_integration_secret fuer anon,
--   4. unnoetige EXECUTE-Grants auf SECURITY-DEFINER-Funktionen,
--   5. Schreibrechte von Fahrern auf Stammdaten und Integrationen,
--   6. TRUNCATE-Recht von anon und authenticated (TRUNCATE ignoriert RLS).
-- Die Datei ist idempotent und mehrfach ausfuehrbar.

-- ---------------------------------------------------------------------------
-- 1) function_search_path_mutable: set_updated_at
-- Der Koerper nutzt ausschliesslich now() und NEW, daher genuegt pg_catalog.
-- public bleibt aus Kompatibilitaetsgruenden hinten angestellt.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- Trigger pruefen EXECUTE nur beim Anlegen, nicht beim Feuern. Der direkte
-- Aufruf ueber /rest/v1/rpc/set_updated_at ist dagegen nutzlos und entfaellt.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Mandantenuebergriff: email_log
-- Die alte Policy erlaubte "shipment_id IS NULL", wodurch jeder angemeldete
-- Nutzer die nicht zugeordneten Eingangsmails aller Companies lesen konnte
-- (Absender, Betreff, Textvorschau). email_log hatte keine company_id.
-- ---------------------------------------------------------------------------

ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS company_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_log_company_id_fkey'
      AND conrelid = 'public.email_log'::regclass
  ) THEN
    ALTER TABLE public.email_log
      ADD CONSTRAINT email_log_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.company(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_email_log_company_id
  ON public.email_log(company_id);

UPDATE public.email_log AS el
SET company_id = s.company_id
FROM public.shipment AS s
WHERE s.id = el.shipment_id
  AND el.company_id IS NULL;

-- Zeilen ohne company_id und ohne shipment_id bleiben bewusst nur fuer
-- service_role sichtbar: die Eingangsverarbeitung laeuft in Edge Functions und
-- muss die Company beim Schreiben selbst setzen.
DROP POLICY IF EXISTS "Users can view own email_logs" ON public.email_log;
DROP POLICY IF EXISTS "Dispatch staff can view own email_logs" ON public.email_log;
CREATE POLICY "Dispatch staff can view own email_logs"
ON public.email_log FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
  AND (
    company_id = public.get_user_company_id()
    OR shipment_id IN (
      SELECT s.id
      FROM public.shipment AS s
      WHERE s.company_id = public.get_user_company_id()
    )
  )
);

-- ---------------------------------------------------------------------------
-- 3) Krypto-Orakel schliessen
-- encrypt_/decrypt_integration_secret laufen als SECURITY DEFINER mit dem
-- Vault-Schluessel "integration_encryption_key" und waren fuer PUBLIC und anon
-- ausfuehrbar. Ein unangemeldeter Aufruf von decrypt konnte damit beliebige
-- Chiffrate entschluesseln. Die Funktionen haben keine Aufrufstelle in src/
-- oder supabase/functions/ mehr; Zugangsdaten liegen seit dem Vault-Umbau
-- (20260806130000) in vault.secrets und werden ueber die Edge Function
-- upsert-integration mit service_role verarbeitet.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.encrypt_integration_secret(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_integration_secret(text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Unnoetige EXECUTE-Grants auf SECURITY-DEFINER-Funktionen
-- ---------------------------------------------------------------------------

-- Wird nur aus handle_new_user aufgerufen. Diese Funktion ist SECURITY DEFINER
-- und postgres-eigen, der Signup-Pfad behaelt sein EXECUTE also ueber die
-- Definer-Kette. Ein direkter Aufruf legt sonst Company-UUIDs offen und wuerde
-- in einer leeren Datenbank ungefragt eine Company anlegen.
REVOKE ALL ON FUNCTION public.ensure_default_company()
  FROM PUBLIC, anon, authenticated;

-- Triggerfunktion an auth.users. Ein direkter Aufruf scheitert ohnehin mit
-- 0A000, das Feuern des Triggers prueft EXECUTE nicht.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END
$$;

-- has_role verriet anon die Rollen fremder Benutzer, sobald deren UUID bekannt
-- war. get_my_role und get_user_company_id liefern fuer anon nur NULL, gehoeren
-- aber nicht in die unangemeldete API-Oberflaeche. authenticated braucht alle
-- drei: sie stehen in den RLS-Policies und werden im Frontend aufgerufen.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_company_id() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Stammdaten: Lesen bleibt companyweit, Schreiben nur fuer Disposition
-- Ein Fahrer konnte Artikel, Packmittel, Depots und Tourenplaene seiner
-- Company anlegen, aendern und loeschen sowie den Company-Namen ueberschreiben.
-- Alle Schreibpfade im Frontend liegen in Dispositions- und Onboarding-Seiten;
-- ein frisch registrierter Benutzer erhaelt ueber handle_new_user die Rolle
-- dispatcher und kann das Onboarding daher unveraendert abschliessen.
-- Die Edge Functions arbeiten mit service_role und umgehen RLS ohnehin.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can manage own artikel" ON public.artikel;
DROP POLICY IF EXISTS "Dispatch staff can manage own artikel" ON public.artikel;
CREATE POLICY "Dispatch staff can manage own artikel"
ON public.artikel FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

DROP POLICY IF EXISTS "Users can manage own packmittel" ON public.packmittel;
DROP POLICY IF EXISTS "Dispatch staff can manage own packmittel" ON public.packmittel;
CREATE POLICY "Dispatch staff can manage own packmittel"
ON public.packmittel FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

DROP POLICY IF EXISTS "Users can manage own depots" ON public.depot;
DROP POLICY IF EXISTS "Dispatch staff can manage own depots" ON public.depot;
CREATE POLICY "Dispatch staff can manage own depots"
ON public.depot FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

DROP POLICY IF EXISTS "Users can manage own touren_plans" ON public.touren_plan;
DROP POLICY IF EXISTS "Dispatch staff can manage own touren_plans" ON public.touren_plan;
CREATE POLICY "Dispatch staff can manage own touren_plans"
ON public.touren_plan FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

DROP POLICY IF EXISTS "Users can insert own plan_runs" ON public.plan_run;
DROP POLICY IF EXISTS "Dispatch staff can insert own plan_runs" ON public.plan_run;
CREATE POLICY "Dispatch staff can insert own plan_runs"
ON public.plan_run FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

DROP POLICY IF EXISTS "Users can update own company" ON public.company;
DROP POLICY IF EXISTS "Dispatch staff can update own company" ON public.company;
CREATE POLICY "Dispatch staff can update own company"
ON public.company FOR UPDATE TO authenticated
USING (
  id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
)
WITH CHECK (
  id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

-- system_integrations enthaelt Hosts, Benutzernamen und die Vault-Referenz der
-- Zugangsdaten. Ein Fahrer konnte Integrationen lesen, deaktivieren und
-- loeschen. Die Policy fuer die Rolle public war zusaetzlich redundant: sie
-- galt auch fuer anon und wurde nur durch das NULL-Ergebnis von auth.uid()
-- unwirksam. Beides entfaellt.
DROP POLICY IF EXISTS "Users can view own company integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Users can view own system integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Users can manage own system integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Dispatch staff can view own system integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Dispatch staff can manage own system integrations" ON public.system_integrations;

CREATE POLICY "Dispatch staff can view own system integrations"
ON public.system_integrations FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

CREATE POLICY "Dispatch staff can manage own system integrations"
ON public.system_integrations FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

-- ---------------------------------------------------------------------------
-- 6) TRUNCATE und Schreibgrants von anon entziehen
-- TRUNCATE wird von RLS nicht geprueft. Der Supabase-Standardgrant
-- "GRANT ALL ON ALL TABLES" gab anon und authenticated damit ein
-- mandantenuebergreifendes Loeschrecht auf jede Tabelle in public. Ueber
-- PostgREST ist das nicht ausloesbar, ueber eine direkte Datenbankverbindung
-- mit diesen Rollen dagegen sehr wohl. Schreibgrants fuer anon entfallen
-- vollstaendig: es gibt keinen unangemeldeten Schreibpfad in der Anwendung.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_maintain TEXT := '';
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    v_maintain := ', MAINTAIN';
  END IF;

  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS ident
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER%s ON TABLE %s FROM anon, authenticated',
      v_maintain, r.ident
    );
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE %s FROM anon',
      r.ident
    );
  END LOOP;
END
$$;

-- Damit kuenftige Tabellen die Rechte nicht erneut erben. Neue Tabellen mit
-- bewusstem anon-Schreibpfad muessen ihre Grants explizit setzen.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE TRUNCATE, MAINTAIN ON TABLES FROM anon, authenticated;
  ELSE
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
  END IF;

  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;
END
$$;
