-- Onboarding ist ein Firmenvorgang (Stammdaten), kein User-Vorgang.
-- users.onboarding_completed_at bleibt als Audit, wer den Wizard abgeschlossen hat.

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.company.onboarding_completed_at IS
  'Zeitpunkt, zu dem die Ersteinrichtung der Firma abgeschlossen wurde. NULL = Wizard noch offen für alle Dispatcher/Admins dieser Firma.';

UPDATE public.company AS c
SET onboarding_completed_at = src.completed_at
FROM (
  SELECT company_id, MIN(onboarding_completed_at) AS completed_at
  FROM public.users
  WHERE onboarding_completed_at IS NOT NULL
    AND company_id IS NOT NULL
  GROUP BY company_id
) AS src
WHERE c.id = src.company_id
  AND c.onboarding_completed_at IS NULL;
