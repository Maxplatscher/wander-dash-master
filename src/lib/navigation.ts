export type SectionId =
  | 'startseite'
  | 'kalender'
  | 'kontrollzentrale'
  | 'fahrer'
  | 'einstellungen'
  | 'probleme';

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'startseite', label: 'Startseite' },
  { id: 'kalender', label: 'Kalender' },
  { id: 'kontrollzentrale', label: 'Lieferscheine' },
  { id: 'fahrer', label: 'Fahrer & Fahrzeuge' },
  { id: 'einstellungen', label: 'Einstellungen' },
  { id: 'probleme', label: 'Probleme' },
];

const LEGACY_SECTION_IDS = new Set(['tagesleitstelle', 'operative-lage']);

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

export function getSectionLabel(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)?.label ?? id;
}
