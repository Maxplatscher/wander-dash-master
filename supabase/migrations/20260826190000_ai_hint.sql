-- Hinweise an die KI und KI-Chat. Aktive Zeilen fliessen als weiche
-- Constraints in plan-tour ein (Zeitfenster-Untergrenze, Fahrzeug-kg-Cap,
-- fruehe Stopps). source trennt die beiden Widgets in den Einstellungen.

CREATE TABLE IF NOT EXISTS public.ai_hint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  role TEXT NOT NULL CHECK (role IN ('disponent', 'ki')),
  text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'hint' CHECK (source IN ('hint', 'chat'))
);

CREATE INDEX IF NOT EXISTS idx_ai_hint_company_source_created
  ON public.ai_hint (company_id, source, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_hint_company_active
  ON public.ai_hint (company_id)
  WHERE is_active;

ALTER TABLE public.ai_hint ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_hint FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_hint TO authenticated;

DROP POLICY IF EXISTS "Dispatch staff can view own ai hints" ON public.ai_hint;
CREATE POLICY "Dispatch staff can view own ai hints"
ON public.ai_hint FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

DROP POLICY IF EXISTS "Dispatch staff can insert own ai hints" ON public.ai_hint;
CREATE POLICY "Dispatch staff can insert own ai hints"
ON public.ai_hint FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
);

DROP POLICY IF EXISTS "Dispatch staff can update own ai hints" ON public.ai_hint;
CREATE POLICY "Dispatch staff can update own ai hints"
ON public.ai_hint FOR UPDATE TO authenticated
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
