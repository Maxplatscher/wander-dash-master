import { describe, expect, it } from 'vitest';
import { isInternalDemoCompany, shouldShowDemoSetup } from './demo-setup-access';

describe('demo-setup Zugang', () => {
  it('erkennt interne Demo-Mandanten am Namen', () => {
    expect(isInternalDemoCompany('Demo A')).toBe(true);
    expect(isInternalDemoCompany('Demo B')).toBe(true);
    expect(isInternalDemoCompany('demo a')).toBe(true);
  });

  it('lässt Kundenmandanten nicht durch', () => {
    expect(isInternalDemoCompany('EISENVATER HAUSTECHNIK')).toBe(false);
    expect(isInternalDemoCompany('Demonstrationsbetrieb GmbH')).toBe(false);
    expect(shouldShowDemoSetup(null)).toBe(false);
  });
});
