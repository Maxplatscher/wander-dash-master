import { describe, expect, it } from 'vitest';
import {
  generateLoginCode,
  isValidLoginCode,
  loginNameKey,
  normalizeDriverName,
} from './driver-name';

describe('driver-name', () => {
  it('trimmt und ignoriert Groß/Klein, nicht aber Buchstaben', () => {
    expect(loginNameKey('  Max ', 'MÜLLER')).toBe(normalizeDriverName('Max Müller'));
    expect(loginNameKey('Max', 'Müller')).not.toBe(loginNameKey('Maximilian', 'Müller'));
  });

  it('akzeptiert nur 4–5 Ziffern als Code', () => {
    expect(isValidLoginCode('4821')).toBe(true);
    expect(isValidLoginCode('48213')).toBe(true);
    expect(isValidLoginCode('482')).toBe(false);
    expect(isValidLoginCode('48a13')).toBe(false);
  });

  it('erzeugt nur 5-stellige Zifferncodes', () => {
    const code = generateLoginCode();
    expect(code).toMatch(/^\d{5}$/);
    expect(Number(code)).toBeGreaterThanOrEqual(10000);
  });
});
