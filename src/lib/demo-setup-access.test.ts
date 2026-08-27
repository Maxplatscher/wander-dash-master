import { describe, expect, it } from 'vitest';
import { isInternalDemoCompany, shouldShowDemoSetup } from './demo-setup-access';

describe('demo-setup Zugang', () => {
  it('erkennt interne Demo-Mandanten', () => {
    expect(isInternalDemoCompany('Demo A')).toBe(true);
    expect(shouldShowDemoSetup('Demo B')).toBe(true);
  });

  it('lässt Kunden raus', () => {
    expect(isInternalDemoCompany('EISENVATER HAUSTECHNIK')).toBe(false);
    expect(shouldShowDemoSetup(null)).toBe(false);
  });
});
