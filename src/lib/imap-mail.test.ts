import { describe, expect, it } from 'vitest';
import { parseShipmentFieldsFromMail } from './imap-mail';

describe('parseShipmentFieldsFromMail', () => {
  it('liest Adresse, PLZ und Gewicht aus dem Text', () => {
    const parsed = parseShipmentFieldsFromMail(
      'Lieferschein Meier GmbH',
      'Kunde: Meier GmbH\nLieferung Steinweg 1, 38100 Braunschweig, 125 kg',
    );
    expect(parsed.customer_name).toMatch(/Meier/);
    expect(parsed.delivery_address).toMatch(/Steinweg/);
    expect(parsed.delivery_address).toMatch(/38100/);
    expect(parsed.weight_kg).toBe(125);
  });

  it('erfindet keine Adresse, wenn keine steckt', () => {
    const parsed = parseShipmentFieldsFromMail('Infomail', 'Nur ein Hinweis ohne Anschrift.');
    expect(parsed.delivery_address).toBeNull();
    expect(parsed.weight_kg).toBeNull();
  });
});
