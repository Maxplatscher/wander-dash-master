import { describe, expect, it } from 'vitest';
import { parseCsvShipments } from './csv-import';

describe('parseCsvShipments', () => {
  it('liest Semikolon-CSV mit deutschen Spalten', () => {
    const rows = parseCsvShipments(
      'Kunde;Adresse;Gewicht;Datum;Lieferschein\nMeier GmbH;Steinweg 1, 38100 Braunschweig;125;2026-08-27;LS-1',
      '2026-08-01',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_name).toBe('Meier GmbH');
    expect(rows[0].delivery_address).toMatch(/Steinweg/);
    expect(rows[0].weight_kg).toBe(125);
    expect(rows[0].name).toBe('LS-1');
  });
});
