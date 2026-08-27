import { supabase } from '@/integrations/supabase/client';

export type GenerateDriverCodeResult = {
  success: boolean;
  driver_id?: string;
  driver_name?: string | null;
  code?: string;
  error?: string;
};

export async function generateDriverCode(driverId: string): Promise<GenerateDriverCodeResult> {
  const { data, error } = await supabase.functions.invoke<GenerateDriverCodeResult>(
    'generate-driver-code',
    { body: { driver_id: driverId } },
  );
  if (data?.error) return { success: false, error: data.error };
  if (error) return { success: false, error: error.message };
  if (!data?.success || !data.code) return { success: false, error: 'Code konnte nicht erzeugt werden.' };
  return data;
}

export type PinLoginResult = {
  success: boolean;
  error?: string;
  locked?: boolean;
};

export async function signInWithDriverPin(
  firstName: string,
  lastName: string,
  code: string,
): Promise<PinLoginResult> {
  const { data, error } = await supabase.functions.invoke('driver-pin-login', {
    body: { first_name: firstName, last_name: lastName, code },
  });
  if (data?.error) {
    return { success: false, error: String(data.error), locked: Boolean(data.locked) };
  }
  if (error) return { success: false, error: error.message, locked: false };
  if (!data?.access_token || !data?.refresh_token) {
    return { success: false, error: 'Anmeldung fehlgeschlagen.' };
  }
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError) return { success: false, error: sessionError.message };
  return { success: true };
}
