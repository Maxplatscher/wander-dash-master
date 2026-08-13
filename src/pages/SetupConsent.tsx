import { useNavigate, Navigate } from 'react-router-dom';
import { ConsentDialog } from '@/components/setup/ConsentDialog';
import { hasConsentDecision } from '@/lib/consent';
import { ParticleBackground } from '@/components/dispatch/ParticleBackground';

export default function SetupConsent() {
  const navigate = useNavigate();

  if (hasConsentDecision()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dashboard relative px-4 py-10">
      <ParticleBackground />
      <div className="relative z-10 w-full flex justify-center">
        <ConsentDialog onComplete={() => navigate('/', { replace: true })} />
      </div>
    </div>
  );
}
