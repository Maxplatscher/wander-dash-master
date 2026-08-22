export type UserRole = 'admin' | 'dispatcher' | 'driver';

export type SectionId =
  | 'startseite'
  | 'kalender'
  | 'kontrollzentrale'
  | 'fahrer'
  | 'einstellungen'
  | 'probleme';

export interface SectionDef {
  id: SectionId;
  label: string;
  roles: UserRole[];
  /** Abweichende Bezeichnung je Rolle (z. B. Fahrer sehen keine Flottenverwaltung). */
  roleLabels?: Partial<Record<UserRole, string>>;
}

/**
 * Einzige Quelle für Navigationseinträge und deren Rollenfreigabe.
 * Ein Fahrer darf per RLS nur seine eigene Tour, seine Stops, seine Sendungen
 * und seinen eigenen Fahrerdatensatz lesen — alle Dispositionsbereiche würden
 * für ihn leer oder mit nicht ausführbaren Aktionen erscheinen.
 */
export const SECTIONS: SectionDef[] = [
  { id: 'startseite', label: 'Startseite', roles: ['admin', 'dispatcher'] },
  { id: 'kalender', label: 'Kalender', roles: ['admin', 'dispatcher'] },
  { id: 'kontrollzentrale', label: 'Lieferscheine', roles: ['admin', 'dispatcher'] },
  {
    id: 'fahrer',
    label: 'Fahrer & Fahrzeuge',
    roles: ['admin', 'dispatcher', 'driver'],
    roleLabels: { driver: 'Meine Tour' },
  },
  { id: 'einstellungen', label: 'Einstellungen', roles: ['admin', 'dispatcher'] },
  { id: 'probleme', label: 'Probleme', roles: ['admin', 'dispatcher'] },
];

const LEGACY_SECTION_IDS = new Set(['tagesleitstelle', 'operative-lage']);

export function getSectionsForRole(role: UserRole): { id: SectionId; label: string }[] {
  return SECTIONS.filter((s) => s.roles.includes(role)).map((s) => ({
    id: s.id,
    label: s.roleLabels?.[role] ?? s.label,
  }));
}

export function isSectionAllowed(id: SectionId, role: UserRole): boolean {
  return SECTIONS.some((s) => s.id === id && s.roles.includes(role));
}

/** Erster für die Rolle freigegebene Bereich — Fahrer landen auf ihrer Tour. */
export function getDefaultSection(role: UserRole): SectionId {
  return getSectionsForRole(role)[0]?.id ?? 'startseite';
}

/**
 * Der Setup-Wizard legt Firmenstammdaten, Depots, Flotte und Integrationen an —
 * dieselben Daten, die der Bereich „Einstellungen“ pflegt. Wer den Bereich nicht
 * sehen darf, darf die Daten per RLS auch nicht schreiben und gehört damit nicht
 * in den Wizard.
 */
export function canRunCompanySetup(role: UserRole): boolean {
  return isSectionAllowed('einstellungen', role);
}

/** Mappt Hash (inkl. alter Bookmarks) auf eine gültige SectionId. */
export function resolveSectionId(raw: string): SectionId {
  if (LEGACY_SECTION_IDS.has(raw)) return 'startseite';
  if (SECTIONS.some((s) => s.id === raw)) return raw as SectionId;
  return 'startseite';
}

export function getInitialSection(): SectionId {
  const raw = window.location.hash.replace('#', '');
  const section = resolveSectionId(raw);

  // Alte Bookmarks und leerer Hash → kanonisch #startseite
  if (LEGACY_SECTION_IDS.has(raw) || raw !== section) {
    history.replaceState(null, '', `#${section}`);
  } else if (!raw) {
    history.replaceState(null, '', `#${section}`);
  }

  return section;
}

export function getSectionLabel(id: SectionId, role?: UserRole): string {
  const section = SECTIONS.find((s) => s.id === id);
  if (!section) return id;
  return (role && section.roleLabels?.[role]) || section.label;
}
