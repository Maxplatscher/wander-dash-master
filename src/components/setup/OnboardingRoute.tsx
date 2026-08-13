import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

type Status = 'loading' | 'needed' | 'done';

/** Nach Login: fehlendes Onboarding → /setup */
export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (authLoading) return;
      if (!user) {
        setStatus('needed');
        return;
      }

      setStatus('loading');
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
          setStatus('needed');
          return;
        }

        setStatus(retry.data?.onboarding_completed_at ? 'done' : 'needed');
        return;
      }

      setStatus(data?.onboarding_completed_at ? 'done' : 'needed');
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'needed') {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
