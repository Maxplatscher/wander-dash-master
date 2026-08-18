import type { SupabaseClient } from '@supabase/supabase-js';

/** Standard-Packmittel-Vorlagen für Onboarding (frei löschbar/editierbar). */
export const DEFAULT_PACKMITTEL = [
  {
    name: 'Europalette',
    length_mm: 1200,
    width_mm: 800,
    height_mm: 144,
    max_weight_kg: 1500,
    stackable: true,
  },
  {
    name: 'Gitterbox',
    length_mm: 1240,
    width_mm: 835,
    height_mm: 970,
    max_weight_kg: 1500,
    stackable: true,
  },
  {
    name: 'Karton S (300×200×150)',
    length_mm: 300,
    width_mm: 200,
    height_mm: 150,
    max_weight_kg: 15,
    stackable: true,
  },
  {
    name: 'Karton M (400×300×300)',
    length_mm: 400,
    width_mm: 300,
    height_mm: 300,
    max_weight_kg: 25,
    stackable: true,
  },
  {
    name: 'Karton L (600×400×400)',
    length_mm: 600,
    width_mm: 400,
    height_mm: 400,
    max_weight_kg: 40,
    stackable: true,
  },
] as const;

export async function seedDefaultPackmittel(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ seeded: boolean; error?: string }> {
  const { count, error: countError } = await supabase
    .from('packmittel')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (countError) return { seeded: false, error: countError.message };
  if ((count ?? 0) > 0) return { seeded: false };

  const { error } = await supabase.from('packmittel').insert(
    DEFAULT_PACKMITTEL.map((p) => ({
      company_id: companyId,
      ...p,
    })),
  );

  if (error) return { seeded: false, error: error.message };
  return { seeded: true };
}
