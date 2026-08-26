import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Liest das firmenweite Onboarding-Flag. Ein zweiter Dispatcher derselben
 * Firma darf nicht erneut durch den Wizard, nur weil sein User-Datensatz
 * noch kein eigenes users.onboarding_completed_at hat.
 */
export function useCompanyOnboardingCompleted(userId: string | undefined, enabled: boolean) {
  const [completed, setCompleted] = useState<boolean | null>(enabled ? null : true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!enabled || !userId) return;
      setCompleted(null);

      const { data, error } = await supabase
        .from('users')
        .select('company_id, company ( onboarding_completed_at )')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('onboarding check failed:', error.message);
        setCompleted(false);
        return;
      }

      const company = data?.company;
      const row = Array.isArray(company) ? company[0] : company;
      setCompleted(Boolean(row?.onboarding_completed_at));
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return completed;
}
