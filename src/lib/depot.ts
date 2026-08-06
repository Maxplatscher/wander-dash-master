export type DepotOption = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
};

/** Select-Wert für „Alle Depots“ */
export const ALL_DEPOTS_VALUE = '__all__';

export const DEPOT_STORAGE_KEY = 'dc_selected_depot_id';

export function readStoredDepotId(): string | null {
  try {
    const raw = localStorage.getItem(DEPOT_STORAGE_KEY);
    if (!raw || raw === ALL_DEPOTS_VALUE) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeStoredDepotId(depotId: string | null) {
  try {
    if (!depotId) localStorage.removeItem(DEPOT_STORAGE_KEY);
    else localStorage.setItem(DEPOT_STORAGE_KEY, depotId);
  } catch {
    // ignore
  }
}

export function depotLabel(depot: DepotOption | null | undefined, fallback = 'Alle Depots'): string {
  if (!depot) return fallback;
  if (depot.code) return `${depot.name} (${depot.code})`;
  return depot.name;
}
