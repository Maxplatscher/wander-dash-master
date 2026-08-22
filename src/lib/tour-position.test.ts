import { describe, expect, it } from 'vitest';
import { pickTourAnchor, shipmentCoordinates, type PositionStop } from './tour-position';

function stop(overrides: Partial<PositionStop> & { id: string }): PositionStop {
  return {
    stopNumber: 1,
    confirmed: false,
    confirmedAt: null,
    customer: 'Kunde',
    address: 'Teststraße 1',
    coordinates: null,
    ...overrides,
  };
}

describe('shipmentCoordinates', () => {
  it('liest location_x als Breitengrad und location_y als Längengrad', () => {
    expect(shipmentCoordinates(48.137, 11.576)).toEqual({ lat: 48.137, lng: 11.576 });
  });

  it('gibt ohne Werte null zurück, statt eine Position zu erfinden', () => {
    expect(shipmentCoordinates(null, null)).toBeNull();
    expect(shipmentCoordinates(48.137, null)).toBeNull();
    expect(shipmentCoordinates(null, 11.576)).toBeNull();
  });

  it('verwirft unbrauchbare Werte', () => {
    expect(shipmentCoordinates(0, 0)).toBeNull();
    expect(shipmentCoordinates(120, 11.576)).toBeNull();
    expect(shipmentCoordinates(48.137, 200)).toBeNull();
    expect(shipmentCoordinates(Number.NaN, 11.576)).toBeNull();
  });
});

describe('pickTourAnchor', () => {
  it('nimmt den letzten bestätigten Stop mit Koordinaten', () => {
    const anchor = pickTourAnchor([
      stop({ id: 'a', stopNumber: 1, confirmed: true, coordinates: { lat: 48.1, lng: 11.5 } }),
      stop({ id: 'b', stopNumber: 2, confirmed: true, coordinates: { lat: 48.2, lng: 11.6 } }),
      stop({ id: 'c', stopNumber: 3, coordinates: { lat: 48.3, lng: 11.7 } }),
    ]);

    expect(anchor?.kind).toBe('confirmed');
    expect(anchor?.stop.id).toBe('b');
  });

  it('fällt auf den nächsten offenen Stop zurück und kennzeichnet ihn als geplant', () => {
    const anchor = pickTourAnchor([
      stop({ id: 'a', stopNumber: 1, coordinates: { lat: 48.1, lng: 11.5 } }),
      stop({ id: 'b', stopNumber: 2, coordinates: { lat: 48.2, lng: 11.6 } }),
    ]);

    expect(anchor?.kind).toBe('planned');
    expect(anchor?.stop.id).toBe('a');
  });

  it('überspringt bestätigte Stops ohne Koordinaten', () => {
    const anchor = pickTourAnchor([
      stop({ id: 'a', stopNumber: 1, confirmed: true, coordinates: null }),
      stop({ id: 'b', stopNumber: 2, coordinates: { lat: 48.2, lng: 11.6 } }),
    ]);

    expect(anchor?.stop.id).toBe('b');
    expect(anchor?.kind).toBe('planned');
  });

  it('gibt ohne jede Koordinate null zurück', () => {
    expect(pickTourAnchor([stop({ id: 'a', confirmed: true }), stop({ id: 'b' })])).toBeNull();
    expect(pickTourAnchor([])).toBeNull();
  });
});
