export type SectionId =
  | 'tagesleitstelle'
  | 'operative-lage'
  | 'kalender'
  | 'kontrollzentrale'
  | 'versionen'
  | 'fahrer'
  | 'einstellungen'
  | 'probleme';

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'tagesleitstelle', label: 'Tagesleitstelle' },
  { id: 'operative-lage', label: 'Operative Lage' },
  { id: 'kalender', label: 'Kalender' },
  { id: 'kontrollzentrale', label: 'Kontrollzentrale' },
  { id: 'versionen', label: 'Versionen & Freigabe' },
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
