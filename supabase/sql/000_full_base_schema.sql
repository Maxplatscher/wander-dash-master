-- Vollstaendiges Basis-Schema fuer eine leere Supabase-Datenbank
-- Direkt im Supabase SQL Editor ausfuehrbar

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- CORE TABLES
-- =========================================================

CREATE TABLE public.company (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.plan_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT,
  input_snapshot JSONB,
  result_snapshot JSONB
);
ALTER TABLE public.plan_run ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vehicle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT,
  capacity INTEGER,
  length_mm INTEGER,
  width_mm INTEGER,
  height_mm INTEGER
);
ALTER TABLE public.vehicle ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.driver (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  status TEXT,
  shift_start TIME,
  shift_end TIME,
  personnel_number TEXT,
  birth_date DATE,
  photo_url TEXT,
  assigned_vehicle_id UUID REFERENCES public.vehicle(id) ON DELETE SET NULL,
  notes TEXT,
  login_code_set_at TIMESTAMPTZ
);
ALTER TABLE public.driver ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.driver_login_secret (
  driver_id UUID PRIMARY KEY REFERENCES public.driver(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);
ALTER TABLE public.driver_login_secret ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.driver_login_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_normalized TEXT NOT NULL,
  ip TEXT,
  success BOOLEAN NOT NULL,
  driver_id UUID REFERENCES public.driver(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_login_attempt ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.driver_login_throttle (
  name_normalized TEXT NOT NULL,
  ip TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  PRIMARY KEY (name_normalized, ip)
);
ALTER TABLE public.driver_login_throttle ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT,
  demand INTEGER,
  location_x DOUBLE PRECISION,
  location_y DOUBLE PRECISION,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  service_date DATE,
  intake_source VARCHAR(50),
  intake_status VARCHAR(50),
  customer_name VARCHAR(300),
  delivery_address VARCHAR(2000),
  email_notes VARCHAR(4000),
  seller_email VARCHAR(255),
  raw_email TEXT,
  positionen JSONB,
  weight_kg INTEGER,
  email_received_at TIMESTAMPTZ,
  email_processed_at TIMESTAMPTZ,
  missing_fields JSONB,
  released_at TIMESTAMPTZ,
  released_by VARCHAR(255)
);
ALTER TABLE public.shipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(900) UNIQUE,
  subject VARCHAR(500),
  from_addr VARCHAR(500),
  status VARCHAR(80) NOT NULL,
  error_detail TEXT,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES public.shipment(id),
  body_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.touren_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  date DATE,
  version INTEGER,
  is_active BOOLEAN DEFAULT false,
  plan_run_id UUID REFERENCES public.plan_run(id),
  total_cost DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.touren_plan ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.driver(id) ON DELETE SET NULL,
  plan_version_id UUID REFERENCES public.touren_plan(id),
  date DATE,
  version INTEGER,
  is_active BOOLEAN DEFAULT false,
  plan_run_id UUID REFERENCES public.plan_run(id),
  total_cost DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tour ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tour_stop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tour(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicle(id),
  shipment_id UUID REFERENCES public.shipment(id),
  stop_index INTEGER,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  segment_cost DOUBLE PRECISION,
  driver_completed BOOLEAN DEFAULT false,
  driver_completed_at TIMESTAMPTZ
);
ALTER TABLE public.tour_stop ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  company_id UUID REFERENCES public.company(id),
  role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  driver_id UUID REFERENCES public.driver(id),
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.packmittel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  length_mm INTEGER,
  width_mm INTEGER,
  height_mm INTEGER,
  max_weight_kg NUMERIC,
  stackable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.packmittel ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.artikel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  artikelnummer TEXT,
  packmittel_id UUID REFERENCES public.packmittel(id) ON DELETE SET NULL,
  length_mm INTEGER,
  width_mm INTEGER,
  height_mm INTEGER,
  weight_kg NUMERIC,
  quelle_url TEXT,
  bestaetigt_von UUID REFERENCES public.users(id) ON DELETE SET NULL,
  bestaetigt_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.artikel ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- AUTH / ROLES
-- =========================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'dispatcher', 'driver');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

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
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.users
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.get_current_driver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.driver_id
  FROM public.users AS u
  WHERE u.id = auth.uid()
    AND u.is_active IS TRUE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_current_driver_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_driver_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_my_tour_stop(p_tour_stop_id UUID)
RETURNS TABLE (
  id UUID,
  driver_completed BOOLEAN,
  driver_completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_company_id UUID;
  v_driver_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'driver') THEN
    RAISE EXCEPTION 'Nur angemeldete Fahrer dürfen Stops abschließen'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.company_id, u.driver_id
  INTO v_user_company_id, v_driver_id
  FROM public.users AS u
  WHERE u.id = auth.uid()
    AND u.is_active IS TRUE;

  IF v_user_company_id IS NULL OR v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Dem Benutzer ist kein aktiver Fahrer zugeordnet'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public.tour_stop AS ts
  SET
    driver_completed = TRUE,
    driver_completed_at = COALESCE(ts.driver_completed_at, statement_timestamp())
  FROM public.tour AS t
  JOIN public.driver AS d ON d.id = t.driver_id
  WHERE ts.id = p_tour_stop_id
    AND ts.tour_id = t.id
    AND t.driver_id = v_driver_id
    AND t.company_id = v_user_company_id
    AND d.company_id = v_user_company_id
    AND t.is_active IS TRUE
  RETURNING ts.id, ts.driver_completed, ts.driver_completed_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stop gehört nicht zu einer aktiven eigenen Tour'
      USING ERRCODE = '42501';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.complete_my_tour_stop(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_my_tour_stop(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_default_company()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH existing AS (
    SELECT id
    FROM public.company
    LIMIT 1
  ),
  inserted AS (
    INSERT INTO public.company (name)
    SELECT 'Standard'
    WHERE NOT EXISTS (SELECT 1 FROM existing)
    RETURNING id
  )
  SELECT id FROM existing
  UNION ALL
  SELECT id FROM inserted
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, company_id, role, is_active)
  VALUES (NEW.id, NEW.email, public.ensure_default_company(), 'dispatcher', true)
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'dispatcher')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- DEPOT + SYSTEM INTEGRATIONS
-- (company_id bewusst OHNE FK, wie gewuenscht)
-- =========================================================

CREATE OR REPLACE FUNCTION public.encrypt_integration_secret(plain_text text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(
    extensions.pgp_sym_encrypt(
      plain_text,
      (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'integration_encryption_key'
        LIMIT 1
      )
    ),
    'base64'
  );
$$;

CREATE OR REPLACE FUNCTION public.decrypt_integration_secret(cipher_text text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN cipher_text IS NULL OR length(cipher_text) = 0 THEN NULL
    ELSE extensions.pgp_sym_decrypt(
      decode(cipher_text, 'base64'),
      (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'integration_encryption_key'
        LIMIT 1
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.encrypt_integration_secret(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_integration_secret(text)
  FROM PUBLIC, anon, authenticated;

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
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.depot ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX depot_company_id_name_key
  ON public.depot (company_id, name);

-- Phase 3A: Sendung → Depot
ALTER TABLE public.shipment
  ADD COLUMN IF NOT EXISTS depot_id UUID REFERENCES public.depot(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_depot_id ON public.shipment (depot_id);

CREATE TABLE public.system_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  depot_id UUID REFERENCES public.depot(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  vault_secret_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_result BOOLEAN,
  last_test_message TEXT,
  last_test_latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_integrations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

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

-- =========================================================
-- RLS POLICIES
-- =========================================================

CREATE POLICY "Users can view own company"
ON public.company FOR SELECT TO authenticated
USING (id = public.get_user_company_id());

CREATE POLICY "Users can view own plan_runs"
ON public.plan_run FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert own plan_runs"
ON public.plan_run FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Dispatch staff can update own company"
ON public.company FOR UPDATE TO authenticated
USING (
  id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Users can view permitted vehicles"
ON public.vehicle FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR id IN (
      SELECT ts.vehicle_id
      FROM public.tour_stop AS ts
      JOIN public.tour AS t ON t.id = ts.tour_id
      WHERE t.driver_id = public.get_current_driver_id()
        AND ts.vehicle_id IS NOT NULL
    )
  )
);

CREATE POLICY "Dispatch staff can manage own vehicles"
ON public.vehicle FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Users can view permitted drivers"
ON public.driver FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR id = public.get_current_driver_id()
  )
);

CREATE POLICY "Dispatch staff can manage own drivers"
ON public.driver FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Users can view permitted shipments"
ON public.shipment FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR id IN (
      SELECT ts.shipment_id
      FROM public.tour_stop AS ts
      JOIN public.tour AS t ON t.id = ts.tour_id
      WHERE t.driver_id = public.get_current_driver_id()
        AND ts.shipment_id IS NOT NULL
    )
  )
);

CREATE POLICY "Dispatch staff can manage own shipments"
ON public.shipment FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Dispatch staff can view own email_logs"
ON public.email_log FOR SELECT TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  AND (
    company_id = public.get_user_company_id()
    OR shipment_id IN (
      SELECT s.id
      FROM public.shipment AS s
      WHERE s.company_id = public.get_user_company_id()
    )
  )
);

CREATE POLICY "Users can view own touren_plans"
ON public.touren_plan FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Dispatch staff can manage own touren_plans"
ON public.touren_plan FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Users can view permitted tours"
ON public.tour FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR driver_id = public.get_current_driver_id()
  )
);

CREATE POLICY "Dispatch staff can manage own tours"
ON public.tour FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Users can view permitted tour stops"
ON public.tour_stop FOR SELECT TO authenticated
USING (
  tour_id IN (
    SELECT t.id
    FROM public.tour AS t
    WHERE t.company_id = public.get_user_company_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'dispatcher')
        OR t.driver_id = public.get_current_driver_id()
      )
  )
);

CREATE POLICY "Dispatch staff can manage own tour stops"
ON public.tour_stop FOR ALL TO authenticated
USING (
  tour_id IN (
    SELECT t.id
    FROM public.tour AS t
    WHERE t.company_id = public.get_user_company_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  )
)
WITH CHECK (
  tour_id IN (
    SELECT t.id
    FROM public.tour AS t
    WHERE t.company_id = public.get_user_company_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  )
);

CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND company_id IS NOT DISTINCT FROM public.get_user_company_id()
  AND driver_id IS NOT DISTINCT FROM public.get_current_driver_id()
  AND email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Users can insert own record"
ON public.users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Table privileges (RLS allein reicht nicht — sonst: permission denied for table users)
GRANT SELECT, UPDATE, INSERT ON TABLE public.users TO authenticated;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own depots"
ON public.depot FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Dispatch staff can manage own depots"
ON public.depot FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Dispatch staff can view own system integrations"
ON public.system_integrations FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Dispatch staff can manage own system integrations"
ON public.system_integrations FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Users can view own packmittel"
ON public.packmittel FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Dispatch staff can manage own packmittel"
ON public.packmittel FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Users can view own artikel"
ON public.artikel FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Dispatch staff can manage own artikel"
ON public.artikel FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
)
WITH CHECK (
  company_id = public.get_user_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
);

-- =========================================================
-- PERFORMANCE INDEXES
-- =========================================================

CREATE INDEX idx_shipment_service_date ON public.shipment(service_date);
CREATE INDEX idx_shipment_intake_status ON public.shipment(intake_status);
CREATE INDEX idx_shipment_company_id ON public.shipment(company_id);
CREATE INDEX idx_tour_date ON public.tour(date);
CREATE INDEX idx_tour_company_id ON public.tour(company_id);
CREATE INDEX idx_tour_driver_id ON public.tour(driver_id);
CREATE UNIQUE INDEX idx_tour_one_active_per_driver_date
  ON public.tour(driver_id, date)
  WHERE driver_id IS NOT NULL AND date IS NOT NULL AND is_active IS TRUE;
CREATE INDEX idx_tour_stop_shipment_id ON public.tour_stop(shipment_id);
CREATE INDEX idx_email_log_created_at ON public.email_log(created_at);
CREATE INDEX idx_email_log_status ON public.email_log(status);
CREATE INDEX idx_email_log_company_id ON public.email_log(company_id);
CREATE INDEX idx_depot_company_id ON public.depot(company_id);
CREATE INDEX idx_depot_active ON public.depot(company_id, is_active);
CREATE INDEX idx_system_integrations_company_id ON public.system_integrations(company_id);
CREATE INDEX idx_system_integrations_depot_id ON public.system_integrations(depot_id);
CREATE INDEX idx_system_integrations_active ON public.system_integrations(company_id, is_active);
CREATE INDEX idx_packmittel_company_id ON public.packmittel(company_id);
CREATE INDEX idx_artikel_company_id ON public.artikel(company_id);
CREATE INDEX idx_artikel_company_name ON public.artikel(company_id, lower(name));
CREATE INDEX idx_artikel_company_nummer ON public.artikel(company_id, artikelnummer)
  WHERE artikelnummer IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_driver_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')));
$$;

CREATE INDEX idx_driver_name_normalized
  ON public.driver (public.normalize_driver_name(name));

CREATE OR REPLACE FUNCTION public.drivers_by_normalized_name(p_name TEXT)
RETURNS TABLE (id UUID, name TEXT, company_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.company_id
  FROM public.driver d
  WHERE public.normalize_driver_name(d.name) = public.normalize_driver_name(p_name);
$$;

REVOKE ALL ON FUNCTION public.normalize_driver_name(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_driver_name(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.drivers_by_normalized_name(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drivers_by_normalized_name(TEXT) TO service_role;

REVOKE ALL ON TABLE public.driver_login_secret FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.driver_login_attempt FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.driver_login_throttle FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.driver_login_secret TO service_role;
GRANT ALL ON TABLE public.driver_login_attempt TO service_role;
GRANT ALL ON TABLE public.driver_login_throttle TO service_role;
