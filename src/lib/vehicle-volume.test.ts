import { describe, expect, it } from 'vitest';
import { cubicMetersFromMm, shipmentFitsVehicle } from './vehicle-volume';

describe('vehicle-volume', () => {
  it('rechnet L×B×H in m³', () => {
    expect(cubicMetersFromMm(4000, 2000, 2000)).toBeCloseTo(16, 6);
    expect(cubicMetersFromMm(null, 2000, 2000)).toBeNull();
    expect(cubicMetersFromMm(0, 2000, 2000)).toBeNull();
  });

  it('lässt Sendungen ohne Volumen durch, solange das Gewicht passt', () => {
    expect(
      shipmentFitsVehicle({
        remainingKg: 800,
        remainingM3: 12,
        shipmentKg: 200,
        shipmentM3: null,
      }),
    ).toBe(true);
  });

  it('blockiert Übergewicht und Übervolumen', () => {
    expect(
      shipmentFitsVehicle({
        remainingKg: 100,
        remainingM3: 12,
        shipmentKg: 200,
        shipmentM3: 1,
      }),
    ).toBe(false);
    expect(
      shipmentFitsVehicle({
        remainingKg: 800,
        remainingM3: 1,
        shipmentKg: 50,
        shipmentM3: 2,
      }),
    ).toBe(false);
  });
});
