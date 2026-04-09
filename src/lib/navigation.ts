export type SectionId =
  | 'tagesleitstelle'
  | 'operative-lage'
  | 'kalender'
  | 'kontrollzentrale'
  | 'fahrer'
  | 'einstellungen'
  | 'probleme';

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'tagesleitstelle', label: 'Startseite' },
  { id: 'operative-lage', label: 'Aktuelle Lage' },
  { id: 'kalender', label: 'Kalender' },
  { id: 'kontrollzentrale', label: 'Lieferscheine & mehr' },
  { id: 'fahrer', label: 'Fahrer & Fahrzeuge' },
  { id: 'einstellungen', label: 'Einstellungen' },
  { id: 'probleme', label: 'Probleme' },
];

export function getInitialSection(): SectionId {
  const hash = window.location.hash.replace('#', '') as SectionId;
  if (SECTIONS.some(s => s.id === hash)) return hash;
  return 'tagesleitstelle';
}

export function getSectionLabel(id: SectionId): string {
  return SECTIONS.find(s => s.id === id)?.label ?? id;
}
