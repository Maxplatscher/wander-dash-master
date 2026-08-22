-- Eine aktuelle GPS-Position pro Fahrer. Disposition liest die Company,
-- Fahrer schreiben nur sich selbst. Aelter als 24 Stunden wird beim
-- naechsten Report geloescht.

CREATE TABLE IF NOT EXISTS public.driver_position (
  driver_id UUID PRIMARY KEY REFERENCES public.driver(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tour_id UUID REFERENCES public.tour(id) ON DELETE SET NULL
);

ALTER TABLE public.driver_position ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.driver_position FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.driver_position TO authenticated;

DROP POLICY IF EXISTS "Dispatch staff can view company driver positions" ON public.driver_position;
CREATE POLICY "Dispatch staff can view company driver positions"
ON public.driver_position FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR driver_id = public.get_current_driver_id()
  )
);

DROP POLICY IF EXISTS "Drivers can write own position" ON public.driver_position;
CREATE POLICY "Drivers can write own position"
ON public.driver_position FOR ALL TO authenticated
USING (
  driver_id = public.get_current_driver_id()
  AND company_id = public.get_user_company_id()
)
WITH CHECK (
  driver_id = public.get_current_driver_id()
  AND company_id = public.get_user_company_id()
);

CREATE OR REPLACE FUNCTION public.report_my_position(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_tour_id UUID DEFAULT NULL
)
RETURNS public.driver_position
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company_id UUID;
  v_driver_id UUID;
  v_row public.driver_position;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'driver') THEN
    RAISE EXCEPTION 'Nur angemeldete Fahrer duerfen eine Position senden'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.company_id, u.driver_id
  INTO v_company_id, v_driver_id
  FROM public.users AS u
  WHERE u.id = auth.uid()
    AND u.is_active IS TRUE;

  IF v_company_id IS NULL OR v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Dem Benutzer ist kein aktiver Fahrer zugeordnet'
      USING ERRCODE = '42501';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180
     OR (p_lat = 0 AND p_lng = 0) THEN
    RAISE EXCEPTION 'Ungueltige Koordinaten'
      USING ERRCODE = '22023';
  END IF;

  IF p_accuracy_m IS NOT NULL AND (p_accuracy_m < 0 OR p_accuracy_m > 500) THEN
    RAISE EXCEPTION 'Ungueltige GPS-Genauigkeit'
      USING ERRCODE = '22023';
  END IF;

  IF p_tour_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.tour AS t
      WHERE t.id = p_tour_id
        AND t.driver_id = v_driver_id
        AND t.company_id = v_company_id
        AND t.is_active IS TRUE
    ) THEN
      RAISE EXCEPTION 'Tour gehoert nicht zu diesem Fahrer'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.driver_position
  WHERE company_id = v_company_id
    AND recorded_at < statement_timestamp() - INTERVAL '24 hours';

  INSERT INTO public.driver_position (
    driver_id, company_id, lat, lng, accuracy_m, recorded_at, tour_id
  )
  VALUES (
    v_driver_id,
    v_company_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    statement_timestamp(),
    p_tour_id
  )
  ON CONFLICT (driver_id) DO UPDATE
  SET
    company_id = EXCLUDED.company_id,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    accuracy_m = EXCLUDED.accuracy_m,
    recorded_at = EXCLUDED.recorded_at,
    tour_id = EXCLUDED.tour_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.report_my_position(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_my_position(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, UUID)
  TO authenticated;
