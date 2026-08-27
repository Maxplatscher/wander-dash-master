import { describe, expect, it } from 'vitest';
import { formatTime } from './format-time';

describe('formatTime', () => {
  it('zeigt Uhrzeiten aus ISO-Zeitstempeln', () => {
    expect(formatTime('2026-08-27T08:15:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('übernimmt reine Uhrzeiten', () => {
    expect(formatTime('8:05')).toBe('08:05');
    expect(formatTime('16:30:00')).toBe('16:30');
  });

  it('fällt bei Datum-ohne-Uhrzeit nicht auf "2026-" zurück', () => {
    expect(formatTime('2026-08-27')).toBe('—');
    expect(formatTime('kein-zeitwert')).toBe('—');
    expect(formatTime(null)).toBe('—');
  });
});
