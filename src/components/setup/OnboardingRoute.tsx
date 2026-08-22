import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, canRunCompanySetup } from '@/lib/navigation';
import { decideOnboardingTarget } from '@/lib/onboarding-redirect';
import { Loader2 } from 'lucide-react';

function RouteSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

/** Nach Login: fehlendes Firmen-Onboarding → /setup, Fahrer direkt in die App */
export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, role, roleResolved, loading: authLoading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  const userRole = (role as UserRole | null) ?? null;
  // Ohne Stammdatenrechte ist der Wizard irrelevant — dann auch keine Abfrage.
  const setupRelevant = userRole !== null && canRunCompanySetup(userRole);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (authLoading || !user || !roleResolved || !setupRelevant) return;

      setOnboardingCompleted(null);
      const { data, error } = await supabase
        .from('users')
        .select('onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // Spalte fehlt noch / Query fehlgeschlagen → Fallback über E-Mail
        const retry = await supabase
          .from('users')
          .select('onboarding_completed_at')
          .eq('email', user.email ?? '')
          .maybeSingle();

        if (cancelled) return;

        if (retry.error) {
          // Migration vermutlich noch nicht da — Setup erzwingen, damit nichts „hängengeblieben“ wirkt
          console.warn('onboarding check failed:', retry.error.message);
          setOnboardingCompleted(false);
          return;
        }

        setOnboardingCompleted(Boolean(retry.data?.onboarding_completed_at));
        return;
      }

      setOnboardingCompleted(Boolean(data?.onboarding_completed_at));
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, roleResolved, setupRelevant]);

  const target = decideOnboardingTarget({
    authLoading,
    hasUser: Boolean(user),
    role: userRole,
    roleResolved,
    onboardingCompleted,
  });

  if (target === 'loading') return <RouteSpinner />;
  if (target === 'signin') return <Navigate to="/auth" replace />;
  if (target === 'setup') return <Navigate to="/setup" replace />;

  return <>{children}</>;
}

/**
 * Schützt den Wizard selbst: Lesezeichen, der alte /setup-consent-Pfad oder ein
 * manuell eingegebener Link dürfen einen Fahrer nicht in die Firmeneinrichtung
 * lassen, für die ihm die Schreibrechte fehlen.
 */
export function CompanySetupRoute({ children }: { children: React.ReactNode }) {
  const { role, roleResolved, loading: authLoading } = useAuth();

  if (authLoading || !roleResolved) return <RouteSpinner />;

  const userRole = (role as UserRole | null) ?? null;
  if (userRole && !canRunCompanySetup(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
