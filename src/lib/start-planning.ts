import { supabase } from '@/integrations/supabase/client';

export type PlanTourResult = {
  geocoded: number;
  geocodeWarning?: string;
  plan: Record<string, unknown> | null;
};

/**
 * Gleiche Vorstufe wie in der Kontrollzentrale: erst Adressen geokodieren,
 * dann Depot zuweisen, dann `plan-tour`.
 */
export async function geocodeThenPlanTour(opts: {
  date: string;
  depotId?: string | null;
}): Promise<PlanTourResult> {
  let geocoded = 0;
  let geocodeWarning: string | undefined;

  const geo = await supabase.functions.invoke('geocode-shipments', {
    body: { date: opts.date },
  });
  if (geo.error) {
    geocodeWarning = geo.error.message;
  } else if (geo.data && typeof geo.data === 'object' && 'error' in geo.data && geo.data.error) {
    geocodeWarning = String(geo.data.error);
  } else {
    geocoded = Number((geo.data as { updated?: number } | null)?.updated ?? 0);
  }

  const assignRes = await supabase.functions.invoke('assign-depot', {
    body: { date: opts.date, force: true },
  });
  if (assignRes.error) throw assignRes.error;
  if (assignRes.data && typeof assignRes.data === 'object' && 'error' in assignRes.data && assignRes.data.error) {
    throw new Error(String(assignRes.data.error));
  }

  const { data, error } = await supabase.functions.invoke('plan-tour', {
    body: {
      date: opts.date,
      ...(opts.depotId ? { depot_id: opts.depotId } : {}),
    },
  });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }

  return {
    geocoded,
    geocodeWarning,
    plan: data && typeof data === 'object' ? (data as Record<string, unknown>) : null,
  };
}

export function planTourSuccessMessage(result: PlanTourResult): string {
  const depot =
    typeof result.plan?.depot_source === 'string' ? ` (Depot: ${result.plan.depot_source})` : '';
  const geo =
    result.geocoded > 0
      ? ` · ${result.geocoded} Adresse${result.geocoded === 1 ? '' : 'n'} geokodiert`
      : '';
  return `Planung gestartet${depot}${geo}`;
}
