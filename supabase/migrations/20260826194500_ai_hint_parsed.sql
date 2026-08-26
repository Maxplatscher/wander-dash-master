-- Jeder Hinweis speichert Originaltext und die erkannte Regel (parsed).
-- Freie Saetze landen als { kind: "note", text } — nichts wird verworfen.

ALTER TABLE public.ai_hint
  ADD COLUMN IF NOT EXISTS parsed JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ai_hint.parsed IS
  'Strukturierte Regel aus dem Hinweistext. kind=note behaelt den vollen Freitext.';
