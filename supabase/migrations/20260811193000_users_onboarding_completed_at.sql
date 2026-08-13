-- Phase Onboarding: Markierung „Ersteinrichtung abgeschlossen“
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.onboarding_completed_at IS
  'Zeitpunkt, zu dem der Setup-Wizard abgeschlossen wurde. NULL = Onboarding offen.';
