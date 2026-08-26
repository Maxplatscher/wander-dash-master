import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { ParticleBackground } from '@/components/dispatch/ParticleBackground';
import { StepCompany } from '@/components/setup/steps/StepCompany';
import { StepFleet } from '@/components/setup/steps/StepFleet';
import { StepPersonal } from '@/components/setup/steps/StepPersonal';
import { StepPermissions } from '@/components/setup/steps/StepPermissions';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  CompanyStepData,
  FleetStepData,
  PersonalStepData,
  emptyCompanyStep,
  emptyFleetStep,
  emptyPersonalStep,
  readOnboardingDraft,
  writeOnboardingDraft,
} from '@/lib/onboarding';

const STEPS = [
  { id: 1, label: 'Unternehmen' },
  { id: 2, label: 'Fahrer & Fahrzeuge' },
  { id: 3, label: 'Persönlich' },
  { id: 4, label: 'Berechtigungen' },
] as const;

export default function Setup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const initial = useMemo(() => readOnboardingDraft(), []);
  const [step, setStep] = useState(initial?.step ?? 1);
  const [company, setCompany] = useState<CompanyStepData>(initial?.company ?? emptyCompanyStep());
  const [fleet, setFleet] = useState<FleetStepData>(initial?.fleet ?? emptyFleetStep());
  const [personal, setPersonal] = useState<PersonalStepData>(
    initial?.personal ?? emptyPersonalStep(user?.email ?? ''),
  );

  const persist = (
    nextStep: number,
    nextCompany: CompanyStepData,
    nextFleet: FleetStepData,
    nextPersonal: PersonalStepData,
  ) => {
    writeOnboardingDraft({
      step: nextStep,
      company: nextCompany,
      fleet: nextFleet,
      personal: nextPersonal,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dashboard relative px-4 py-10">
      <ParticleBackground />
      <div className="relative z-10 w-full max-w-lg">
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">DispoCenter einrichten</h1>
            <p className="text-sm text-muted-foreground">
              Schritt {step} von {STEPS.length} — {STEPS[step - 1]?.label}
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  s.id === step ? 'w-8 bg-primary' : s.id < step ? 'w-4 bg-primary/50' : 'w-4 bg-white/15',
                )}
                title={s.label}
              />
            ))}
          </div>

          {step === 1 && (
            <StepCompany
              value={company}
              onChange={(next) => {
                setCompany(next);
                persist(1, next, fleet, personal);
              }}
              onContinue={(saved) => {
                setCompany(saved);
                setStep(2);
                persist(2, saved, fleet, personal);
              }}
            />
          )}

          {step === 2 && (
            <StepFleet
              companyId={company.companyId}
              value={fleet}
              onChange={(next) => {
                setFleet(next);
                persist(2, company, next, personal);
              }}
              onBack={() => {
                setStep(1);
                persist(1, company, fleet, personal);
              }}
              onContinue={(saved) => {
                setFleet(saved);
                setStep(3);
                persist(3, company, saved, personal);
              }}
            />
          )}

          {step === 3 && (
            <StepPersonal
              value={personal}
              onChange={(next) => {
                setPersonal(next);
                persist(3, company, fleet, next);
              }}
              onBack={() => {
                setStep(2);
                persist(2, company, fleet, personal);
              }}
              onContinue={(saved) => {
                setPersonal(saved);
                setStep(4);
                persist(4, company, fleet, saved);
              }}
            />
          )}

          {step === 4 && (
            <StepPermissions
              onBack={() => {
                setStep(3);
                persist(3, company, fleet, personal);
              }}
              onComplete={() => navigate('/', { replace: true })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
