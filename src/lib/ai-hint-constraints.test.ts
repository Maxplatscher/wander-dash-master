import { describe, expect, it } from 'vitest';
import {
  applyHintConstraints,
  hintAdjustedDistance,
  parseHintConstraint,
  parseHintConstraints,
} from './ai-hint-constraints';

describe('parseHintConstraint', () => {
  it('liest Zeitfenster-Untergrenzen', () => {
    expect(
      parseHintConstraint('Baustoffe Krüger nie vor 09:00 anfahren, die Rampe ist vorher belegt.'),
    ).toEqual({ kind: 'earliest_window', needle: 'Baustoffe Krüger', time: '09:00' });
  });

  it('liest die KI-Umformulierung derselben Regel', () => {
    expect(
      parseHintConstraint(
        'Notiert. Sendungen an Baustoffe Krüger bekommen ab jetzt ein Zeitfenster ab 09:00, auch wenn der Lieferschein früher angibt.',
      ),
    ).toMatchObject({ kind: 'earliest_window', needle: 'Baustoffe Krüger', time: '09:00' });
  });

  it('liest Fahrer-Gewichtslimits', () => {
    expect(parseHintConstraint('Sarah Weber fährt keine Touren über 900 kg.')).toEqual({
      kind: 'max_load',
      needle: 'Sarah Weber',
      kg: 900,
    });
  });

  it('liest bevorzugte Erststops aus dem Chat', () => {
    expect(
      parseHintConstraint(
        'Tour 4 gestern: Müller hätte zuerst angefahren werden müssen, der Umweg über Krüger war unsinnig.',
      ),
    ).toEqual({ kind: 'prefer_first', needle: 'Müller' });
  });

  it('liest Zeitfenster-Obergrenzen', () => {
    expect(parseHintConstraint('Depot Süd nicht nach 16:00 beladen.')).toEqual({
      kind: 'latest_window',
      needle: 'Depot Süd',
      time: '16:00',
    });
  });

  it('speichert freie Hinweise vollständig als note', () => {
    expect(parseHintConstraint('Kunden auf der Insel immer mit Plane fahren.')).toEqual({
      kind: 'note',
      text: 'Kunden auf der Insel immer mit Plane fahren.',
    });
  });
});

describe('applyHintConstraints', () => {
  it('setzt Zeitfenster und defers Matching-Sendungen', () => {
    const { shipments, applied } = applyHintConstraints(
      [
        {
          id: '1',
          customer_name: 'Baustoffe Krüger',
          name: 'LS-1',
          window_start: '2026-08-26T06:00:00Z',
        },
        { id: '2', customer_name: 'Meier GmbH', name: 'LS-2', window_start: null },
      ],
      [],
      parseHintConstraints(['Baustoffe Krüger nie vor 09:00 anfahren.']),
      '2026-08-26',
    );
    expect(shipments[0].deferEarly).toBe(true);
    expect(shipments[0].window_start).toBe('2026-08-26T09:00:00');
    expect(shipments[1].deferEarly).toBeUndefined();
    expect(applied[0].matched_shipments).toBe(1);
  });

  it('kappt passende Fahrzeugkapazität nach unten', () => {
    const { vehicles } = applyHintConstraints(
      [],
      [
        { id: 'v1', name: 'Sarah Weber', capacity: 1400 },
        { id: 'v2', name: 'Sprinter Nord', capacity: 1400 },
      ],
      parseHintConstraints(['Sarah Weber fährt keine Touren über 900 kg.']),
      '2026-08-26',
    );
    expect(vehicles[0].capacity).toBe(900);
    expect(vehicles[1].capacity).toBe(1400);
  });
});

describe('hintAdjustedDistance', () => {
  it('macht Erststops attraktiver und deferred Stops zu Beginn teurer', () => {
    expect(hintAdjustedDistance(1000, true, false, 0)).toBe(350);
    expect(hintAdjustedDistance(1000, false, true, 0)).toBe(81_000);
    expect(hintAdjustedDistance(1000, false, true, 2)).toBe(1000);
    expect(hintAdjustedDistance(1000, false, false, 0, true)).toBe(51_800);
  });
});
