-- Phase 3A: Depot-Koordinaten + Zuordnung Sendung → Depot

ALTER TABLE public.depot
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_depot_company_coords
  ON public.depot (company_id)
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND is_active = true;

ALTER TABLE public.shipment
  ADD COLUMN IF NOT EXISTS depot_id UUID REFERENCES public.depot(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_depot_id
  ON public.shipment (depot_id);

CREATE INDEX IF NOT EXISTS idx_shipment_company_depot
  ON public.shipment (company_id, depot_id);
