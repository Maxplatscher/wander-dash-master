import { describe, expect, it } from 'vitest';
import { normalizeSetupStep } from './onboarding';

describe('normalizeSetupStep', () => {
  it('lässt die ersten drei Schritte unverändert', () => {
    expect(normalizeSetupStep(1)).toBe(1);
    expect(normalizeSetupStep(2)).toBe(2);
    expect(normalizeSetupStep(3)).toBe(3);
  });

  it('legt den alten Design-Schritt und den alten Berechtigungsschritt auf den neuen letzten Schritt', () => {
    expect(normalizeSetupStep(4)).toBe(4);
    expect(normalizeSetupStep(5)).toBe(4);
  });

  it('fällt bei unsinnigen Werten auf Schritt 1 zurück', () => {
    expect(normalizeSetupStep(undefined)).toBe(1);
    expect(normalizeSetupStep(0)).toBe(1);
  });
});
