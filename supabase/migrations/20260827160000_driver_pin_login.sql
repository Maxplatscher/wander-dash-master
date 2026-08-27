-- Fahrer-PIN: Hash und Lock-Daten nicht auf `driver` (sonst lägen Hashes in jedem SELECT *).
-- Dispatcher sieht nur, ob ein Code gesetzt ist (`driver.login_code_set_at`).

ALTER TABLE public.driver
  ADD COLUMN IF NOT EXISTS login_code_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.driver.login_code_set_at IS
  'Zeitpunkt der letzten Code-Vergabe. Der Hash liegt in driver_login_secret.';

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

CREATE INDEX idx_driver_login_attempt_name_ip_time
  ON public.driver_login_attempt (name_normalized, ip, created_at DESC);

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

CREATE OR REPLACE FUNCTION public.normalize_driver_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')));
$$;

CREATE INDEX IF NOT EXISTS idx_driver_name_normalized
  ON public.driver (public.normalize_driver_name(name));

REVOKE ALL ON FUNCTION public.normalize_driver_name(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_driver_name(TEXT) TO service_role;

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

REVOKE ALL ON FUNCTION public.drivers_by_normalized_name(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drivers_by_normalized_name(TEXT) TO service_role;

REVOKE ALL ON TABLE public.driver_login_secret FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.driver_login_attempt FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.driver_login_throttle FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.driver_login_secret TO service_role;
GRANT ALL ON TABLE public.driver_login_attempt TO service_role;
GRANT ALL ON TABLE public.driver_login_throttle TO service_role;
