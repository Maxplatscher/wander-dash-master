-- Sendungen an die Intake-Quelle binden, damit Lieferschein-Ordner
-- Dokumente zaehlen und "zuletzt gelesen" anzeigen koennen.
-- fetch-imap schreibt integration_id beim Insert.

ALTER TABLE public.shipment
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.system_integrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_company_integration
  ON public.shipment (company_id, integration_id)
  WHERE integration_id IS NOT NULL;
