import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke, setSession } = vi.hoisted(() => ({
  invoke: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke },
    auth: { setSession },
  },
}));

import { generateDriverCode, signInWithDriverPin } from './driver-pin';

describe('driver-pin client', () => {
  beforeEach(() => {
    invoke.mockReset();
    setSession.mockReset();
    setSession.mockResolvedValue({ error: null });
  });

  it('liest die deutsche Fehlermeldung aus dem Function-Body, nicht nur HTTP-Status', async () => {
    invoke.mockResolvedValue({
      data: { error: 'Name oder Code falsch.', locked: false },
      error: { message: 'Edge Function returned a non-2xx status code' },
    });
    const result = await signInWithDriverPin('Max', 'Müller', '12345');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Name oder Code falsch.');
  });

  it('meldet Sperre bei 429', async () => {
    invoke.mockResolvedValue({
      data: { error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.', locked: true },
      error: { message: 'Edge Function returned a non-2xx status code' },
    });
    const result = await signInWithDriverPin('Max', 'Müller', '00000');
    expect(result.locked).toBe(true);
  });

  it('gibt den einmaligen Klartext-Code nach generate-driver-code zurück', async () => {
    invoke.mockResolvedValue({
      data: { success: true, code: '48213', driver_id: 'd1' },
      error: null,
    });
    const result = await generateDriverCode('d1');
    expect(result.success).toBe(true);
    expect(result.code).toBe('48213');
  });
});
