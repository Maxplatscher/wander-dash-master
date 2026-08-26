import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyOnboardingCompleted } from '@/hooks/useCompanyOnboardingCompleted';
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

  const userRole = (role as UserRole | null) ?? null;
  const setupRelevant = userRole !== null && canRunCompanySetup(userRole);
  const onboardingCompleted = useCompanyOnboardingCompleted(user?.id, Boolean(!authLoading && user && roleResolved && setupRelevant));

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
 * lassen. Ist die Firma bereits eingerichtet, gehört ein zweiter Dispatcher
 * ebenfalls nicht in den Wizard.
 */
export function CompanySetupRoute({ children }: { children: React.ReactNode }) {
  const { user, role, roleResolved, loading: authLoading } = useAuth();

  const userRole = (role as UserRole | null) ?? null;
  const setupRelevant = userRole !== null && canRunCompanySetup(userRole);
  const onboardingCompleted = useCompanyOnboardingCompleted(
    user?.id,
    Boolean(!authLoading && user && roleResolved && setupRelevant),
  );

  if (authLoading || !roleResolved) return <RouteSpinner />;

  if (userRole && !canRunCompanySetup(userRole)) {
    return <Navigate to="/" replace />;
  }

  if (setupRelevant && onboardingCompleted === null) return <RouteSpinner />;
  if (onboardingCompleted) return <Navigate to="/" replace />;

  return <>{children}</>;
}
