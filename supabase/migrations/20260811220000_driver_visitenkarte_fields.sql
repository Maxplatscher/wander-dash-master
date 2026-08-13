-- Onboarding Schritt 2: Erweiterte Fahrer-Visitenkarte
ALTER TABLE public.driver
  ADD COLUMN IF NOT EXISTS personnel_number TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES public.vehicle(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.driver.personnel_number IS 'Interne Personalnummer (optional)';
COMMENT ON COLUMN public.driver.birth_date IS 'Geburtsdatum (optional)';
COMMENT ON COLUMN public.driver.photo_url IS 'Pfad oder URL zum Fahrerfoto (Storage, optional)';
COMMENT ON COLUMN public.driver.assigned_vehicle_id IS 'Fest zugewiesenes Fahrzeug (optional)';
COMMENT ON COLUMN public.driver.notes IS 'Sonstige Hinweise zum Fahrer (optional)';
