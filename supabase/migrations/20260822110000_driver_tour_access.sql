-- Direkte Fahrerzuordnung, eng begrenzter Fahrerzugriff und persistenter Stopabschluss.

ALTER TABLE public.tour
  ADD COLUMN IF NOT EXISTS driver_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN LATERAL unnest(c.conkey) AS fk_column(attnum) ON TRUE
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
      AND a.attnum = fk_column.attnum
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.tour'::regclass
      AND c.confrelid = 'public.driver'::regclass
      AND a.attname = 'driver_id'
  ) THEN
    ALTER TABLE public.tour
      ADD CONSTRAINT tour_driver_id_fkey
      FOREIGN KEY (driver_id)
      REFERENCES public.driver(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tour_driver_id
  ON public.tour(driver_id);

-- Bei einer Erstinstallation ist driver_id noch leer und der Index kann sicher
-- angelegt werden. Bei bereits manuell erweiterten Legacy-Daten bleiben
-- vorhandene Dubletten unangetastet, statt das gesamte Deployment abzubrechen.
DO $$
BEGIN
  IF to_regclass('public.idx_tour_one_active_per_driver_date') IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.tour
      WHERE driver_id IS NOT NULL
        AND date IS NOT NULL
        AND is_active IS TRUE
      GROUP BY driver_id, date
      HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX idx_tour_one_active_per_driver_date
        ON public.tour(driver_id, date)
        WHERE driver_id IS NOT NULL
          AND date IS NOT NULL
          AND is_active IS TRUE;
    ELSE
      RAISE NOTICE
        'idx_tour_one_active_per_driver_date nicht angelegt: aktive Legacy-Dubletten vorhanden';
    END IF;
  END IF;
END
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
  JOIN public.driver AS d
    ON d.id = t.driver_id
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

-- Die Fahreridentität darf nicht über ein Self-Service-UPDATE von users
-- umgebogen werden. Rolle und Onboarding-Felder bleiben wie bisher änderbar.
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND company_id IS NOT DISTINCT FROM public.get_user_company_id()
  AND driver_id IS NOT DISTINCT FROM public.get_current_driver_id()
  AND email = (auth.jwt() ->> 'email')
);

-- Die alten Policies sind permissiv. Parallele Fahrer-Policies könnten sie
-- deshalb nicht einschränken; sie müssen gezielt ersetzt werden.
DROP POLICY IF EXISTS "Users can view own vehicles" ON public.vehicle;
DROP POLICY IF EXISTS "Users can view permitted vehicles" ON public.vehicle;
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

DROP POLICY IF EXISTS "Users can manage own vehicles" ON public.vehicle;
DROP POLICY IF EXISTS "Dispatch staff can manage own vehicles" ON public.vehicle;
CREATE POLICY "Dispatch staff can manage own vehicles"
ON public.vehicle FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Users can view own drivers" ON public.driver;
DROP POLICY IF EXISTS "Users can view permitted drivers" ON public.driver;
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

DROP POLICY IF EXISTS "Users can manage own drivers" ON public.driver;
DROP POLICY IF EXISTS "Dispatch staff can manage own drivers" ON public.driver;
CREATE POLICY "Dispatch staff can manage own drivers"
ON public.driver FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Users can view own shipments" ON public.shipment;
DROP POLICY IF EXISTS "Users can view permitted shipments" ON public.shipment;
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

DROP POLICY IF EXISTS "Users can manage own shipments" ON public.shipment;
DROP POLICY IF EXISTS "Dispatch staff can manage own shipments" ON public.shipment;
CREATE POLICY "Dispatch staff can manage own shipments"
ON public.shipment FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Users can view own tours" ON public.tour;
DROP POLICY IF EXISTS "Users can view permitted tours" ON public.tour;
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

DROP POLICY IF EXISTS "Users can manage own tours" ON public.tour;
DROP POLICY IF EXISTS "Dispatch staff can manage own tours" ON public.tour;
CREATE POLICY "Dispatch staff can manage own tours"
ON public.tour FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Users can view own tour_stops" ON public.tour_stop;
DROP POLICY IF EXISTS "Users can view permitted tour stops" ON public.tour_stop;
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

DROP POLICY IF EXISTS "Users can manage own tour_stops" ON public.tour_stop;
DROP POLICY IF EXISTS "Dispatch staff can manage own tour stops" ON public.tour_stop;
CREATE POLICY "Dispatch staff can manage own tour stops"
ON public.tour_stop FOR ALL TO authenticated
USING (
  tour_id IN (
    SELECT t.id
    FROM public.tour AS t
    WHERE t.company_id = public.get_user_company_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'dispatcher')
      )
  )
)
WITH CHECK (
  tour_id IN (
    SELECT t.id
    FROM public.tour AS t
    WHERE t.company_id = public.get_user_company_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'dispatcher')
      )
  )
);
