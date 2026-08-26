import { describe, expect, it } from 'vitest';
import { formatHintFooter, rephraseDispatchHint } from './ai-hint-rephrase';

describe('rephraseDispatchHint', () => {
  it('übersetzt Zeitfenster in eine Planungsregel', () => {
    expect(
      rephraseDispatchHint(
        'Baustoffe Krüger nie vor 09:00 anfahren, die Rampe ist vorher belegt.',
      ),
    ).toMatch(/Zeitfenster ab 09:00/);
  });

  it('übersetzt Fahrer-Gewichtslimits', () => {
    expect(rephraseDispatchHint('Sarah Weber fährt keine Touren über 900 kg.')).toMatch(
      /900 kg begrenzt/,
    );
  });

  it('formuliert Zeitfenster-Obergrenzen um, ohne Platzhalter', () => {
    const text = rephraseDispatchHint('Depot Süd nicht nach 16:00 beladen.');
    expect(text.startsWith('Notiert.')).toBe(true);
    expect(text).toMatch(/bis 16:00/);
    expect(text.toLowerCase()).not.toContain('platzhalter');
  });

  it('übernimmt freie Hinweise vollständig', () => {
    const text = rephraseDispatchHint('Kunden auf der Insel immer mit Plane fahren.');
    expect(text).toContain('Kunden auf der Insel immer mit Plane fahren');
    expect(text.toLowerCase()).not.toContain('platzhalter');
  });
});

describe('formatHintFooter', () => {
  it('zählt Disponenten-Hinweise', () => {
    expect(
      formatHintFooter(
        [
          { role: 'disponent', text: 'a', at: '2026-08-26T07:24:00.000Z' },
          { role: 'ki', text: 'b', at: '2026-08-26T07:24:01.000Z' },
          { role: 'disponent', text: 'c', at: '2026-08-26T07:24:02.000Z' },
          { role: 'ki', text: 'd', at: '2026-08-26T07:24:03.000Z' },
        ],
        new Date('2026-08-26T12:00:00.000Z'),
      ),
    ).toMatch(/^2 gespeicherte Hinweise · zuletzt heute /);
  });
});
