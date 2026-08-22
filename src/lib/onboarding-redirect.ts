import { UserRole, canRunCompanySetup } from './navigation';

export type OnboardingTarget = 'loading' | 'signin' | 'setup' | 'app';

export interface OnboardingRedirectState {
  /** Supabase-Session wird noch aufgelöst. */
  authLoading: boolean;
  hasUser: boolean;
  /** Ergebnis von get_my_role(); null solange unbekannt oder nach fehlgeschlagenem Abruf. */
  role: UserRole | null;
  /** true sobald der Rollen-Abruf beendet ist — auch bei Fehler oder Timeout. */
  roleResolved: boolean;
  /** users.onboarding_completed_at als Boolean; null solange nicht geladen. */
  onboardingCompleted: boolean | null;
}

/**
 * Entscheidet, wohin ein angemeldeter Nutzer nach dem Login gehört.
 *
 * Die Rolle kommt asynchron über einen zusätzlichen RPC. Solange sie unbekannt
 * ist, wird gewartet statt weitergeleitet: eine Weiterleitung nach /setup lässt
 * sich — anders als ein kurz sichtbarer Menüpunkt — nicht zurücknehmen, ohne den
 * Nutzer aus dem Flow zu reißen.
 */
export function decideOnboardingTarget(state: OnboardingRedirectState): OnboardingTarget {
  if (state.authLoading) return 'loading';
  if (!state.hasUser) return 'signin';
  if (!state.roleResolved) return 'loading';

  // Rolle trotz beendetem Abruf unbekannt (Fehler oder Timeout): die App zeigen.
  // Der Wizard bleibt über /setup erreichbar, ein Fahrer steckt aber nicht darin fest.
  if (!state.role) return 'app';

  // Fahrer haben keine Stammdatenrechte — der Firmen-Wizard wäre eine Sackgasse.
  if (!canRunCompanySetup(state.role)) return 'app';

  if (state.onboardingCompleted === null) return 'loading';
  return state.onboardingCompleted ? 'app' : 'setup';
}
