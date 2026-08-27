/**
 * Anzeige von Zeitfenstern (`window_start` / `window_end`).
 * Werte können timestamptz, Uhrzeit ("08:00") oder Datum+Zeit sein.
 * Ein reines Datum oder ein fehlgeschlagener Parse darf nie als "2026-" enden.
 */
export function formatTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  const value = raw.trim();
  if (!value) return '—';

  const timeOnly = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z)?$/);
  if (timeOnly) {
    return `${timeOnly[1].padStart(2, '0')}:${timeOnly[2]}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  const embedded = value.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (embedded) {
    return `${embedded[1].padStart(2, '0')}:${embedded[2]}`;
  }

  return '—';
}
