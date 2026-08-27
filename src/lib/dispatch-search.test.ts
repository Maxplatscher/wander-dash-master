import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearchQuery } from './dispatch-search';

describe('dispatch-search', () => {
  it('lässt leere Suche alles durch', () => {
    expect(matchesSearch('', 'Müller', 'Berlin')).toBe(true);
    expect(normalizeSearchQuery('  ')).toBe('');
  });

  it('filtert über Sendung, Fahrer und Adresse', () => {
    expect(matchesSearch('berlin', 'LS-12', 'Müller', 'Berliner Str. 1')).toBe(true);
    expect(matchesSearch('fahrer a', 'Fahrer A', null, 'Hamburg')).toBe(true);
    expect(matchesSearch('xyz', 'LS-12', 'Müller')).toBe(false);
  });
});
