import { supabase } from '@/integrations/supabase/client';

export type InviteDriverResult = {
  success: boolean;
  user_id?: string;
  email?: string;
  temporary_password?: string;
  created?: boolean;
  error?: string;
};

export function isValidInviteEmail(value: string | null | undefined): boolean {
  const email = (value ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function inviteDriverAccount(
  driverId: string,
  email: string,
): Promise<InviteDriverResult> {
  const { data, error } = await supabase.functions.invoke<InviteDriverResult>('invite-driver', {
    body: { driver_id: driverId, email: email.trim() },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  if (!data?.success) return { success: false, error: 'Einladung fehlgeschlagen.' };
  return data;
}
