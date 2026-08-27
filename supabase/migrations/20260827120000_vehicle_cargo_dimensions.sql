-- Laderaum-Maße für Volumenplanung (nullable — bestehende Fahrzeuge bleiben gültig).
ALTER TABLE public.vehicle
  ADD COLUMN IF NOT EXISTS length_mm INTEGER,
  ADD COLUMN IF NOT EXISTS width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS height_mm INTEGER;

COMMENT ON COLUMN public.vehicle.length_mm IS 'Innenlänge in mm; zusammen mit Breite/Höhe ergibt Nutzvolumen.';
COMMENT ON COLUMN public.vehicle.width_mm IS 'Innenbreite in mm.';
COMMENT ON COLUMN public.vehicle.height_mm IS 'Innenhöhe in mm.';
