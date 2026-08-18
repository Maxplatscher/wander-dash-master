-- Artikel- und Packmittel-Stammdaten (pro Company)

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

ALTER TABLE public.packmittel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artikel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own packmittel"
ON public.packmittel FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage own packmittel"
ON public.packmittel FOR ALL TO authenticated
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can view own artikel"
ON public.artikel FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage own artikel"
ON public.artikel FOR ALL TO authenticated
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX idx_packmittel_company_id ON public.packmittel(company_id);
CREATE INDEX idx_artikel_company_id ON public.artikel(company_id);
CREATE INDEX idx_artikel_company_name ON public.artikel(company_id, lower(name));
CREATE INDEX idx_artikel_company_nummer ON public.artikel(company_id, artikelnummer)
  WHERE artikelnummer IS NOT NULL;
