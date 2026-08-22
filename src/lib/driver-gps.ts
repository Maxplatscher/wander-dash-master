export const GPS_FRESH_MS = 5 * 60 * 1000;
export const GPS_USABLE_MS = 30 * 60 * 1000;
export const GPS_MAX_ACCURACY_M = 250;

export type GpsFix = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
};

export type GpsFreshness = "fresh" | "stale" | "expired";

export function gpsAgeMs(recordedAt: string, now = Date.now()): number {
  const at = new Date(recordedAt).getTime();
  if (!Number.isFinite(at)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - at);
}

export function classifyGpsFix(
  fix: Pick<GpsFix, "accuracyM" | "recordedAt">,
  now = Date.now(),
): GpsFreshness {
  if (fix.accuracyM != null && fix.accuracyM > GPS_MAX_ACCURACY_M) return "expired";
  const age = gpsAgeMs(fix.recordedAt, now);
  if (age <= GPS_FRESH_MS) return "fresh";
  if (age <= GPS_USABLE_MS) return "stale";
  return "expired";
}

export function isUsableGpsFix(fix: Pick<GpsFix, "accuracyM" | "recordedAt">, now = Date.now()): boolean {
  return classifyGpsFix(fix, now) !== "expired";
}

export function formatGpsAge(recordedAt: string, now = Date.now()): string {
  const age = gpsAgeMs(recordedAt, now);
  const minutes = Math.round(age / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes === 1) return "vor 1 Min";
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "vor 1 Std";
  return `vor ${hours} Std`;
}

export function gpsBadgeLabel(
  fixes: Array<Pick<GpsFix, "recordedAt" | "accuracyM">>,
  now = Date.now(),
): string {
  const usable = fixes
    .filter((fix) => isUsableGpsFix(fix, now))
    .sort((a, b) => gpsAgeMs(a.recordedAt, now) - gpsAgeMs(b.recordedAt, now));
  if (usable.length === 0) return "Keine GPS-Ortung";
  return `GPS ${formatGpsAge(usable[0].recordedAt, now)}`;
}
