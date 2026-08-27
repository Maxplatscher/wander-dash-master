import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { isValidInviteEmail } from './invite-driver';

describe('isValidInviteEmail', () => {
  it('akzeptiert normale Firmenadressen', () => {
    expect(isValidInviteEmail('max@firma.de')).toBe(true);
    expect(isValidInviteEmail('  max@firma.de  ')).toBe(true);
  });

  it('lehnt leere und kaputte Werte ab', () => {
    expect(isValidInviteEmail('')).toBe(false);
    expect(isValidInviteEmail(null)).toBe(false);
    expect(isValidInviteEmail('kein-at-zeichen')).toBe(false);
  });
});
