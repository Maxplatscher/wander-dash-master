export const CONSENT_STORAGE_KEY = 'dc_consent_v1';

export type DeviceOs = 'windows' | 'macos' | 'linux' | 'other';

export const OS_LABELS: Record<DeviceOs, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  other: 'Sonstiges',
};

export type ConsentState = {
  /** Einwilligung zur Nutzung von Zeit/Datum am Gerät */
  time: boolean;
  /** Einwilligung zur Standortbestimmung (Browser-Geolocation) */
  location: boolean;
  /** Einwilligung: KI darf Lieferschein-Uploads auslesen */
  deliveryFolder: boolean;
  /** Bestätigtes Betriebssystem für lokale Ordnerpfade */
  os: DeviceOs;
  /** ISO-Zeitpunkt der Entscheidung */
  decidedAt: string;
};

export function detectDeviceOs(): DeviceOs {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (!nav) return 'other';

  const uaData = (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = (uaData?.platform || nav.platform || '').toLowerCase();
  const ua = (nav.userAgent || '').toLowerCase();

  if (platform.includes('win') || ua.includes('windows')) return 'windows';
  if (platform.includes('mac') || ua.includes('mac os')) return 'macos';
  if (platform.includes('linux') || ua.includes('linux')) return 'linux';
  return 'other';
}

export function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed.time !== 'boolean' || typeof parsed.location !== 'boolean') {
      return null;
    }
    const os: DeviceOs =
      parsed.os === 'windows' || parsed.os === 'macos' || parsed.os === 'linux' || parsed.os === 'other'
        ? parsed.os
        : detectDeviceOs();

    return {
      time: parsed.time,
      location: parsed.location,
      deliveryFolder: typeof parsed.deliveryFolder === 'boolean' ? parsed.deliveryFolder : false,
      os,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** true, sobald der Nutzer den Consent-Schritt abgeschlossen hat. */
export function hasConsentDecision(): boolean {
  return readConsent() !== null;
}

export function writeConsent(
  partial: Omit<ConsentState, 'decidedAt'> & { decidedAt?: string },
): ConsentState {
  const next: ConsentState = {
    time: partial.time,
    location: partial.location,
    deliveryFolder: partial.deliveryFolder,
    os: partial.os,
    decidedAt: partial.decidedAt ?? new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearConsent(): void {
  localStorage.removeItem(CONSENT_STORAGE_KEY);
}

/** Fahrer-GPS auf „Meine Tour“ — unabhängig vom Dispatcher-Onboarding. */
export const DRIVER_GPS_STORAGE_KEY = 'dc_driver_gps_v1';

export type DriverGpsConsent = {
  allowed: boolean;
  decidedAt: string;
};

export function readDriverGpsConsent(): DriverGpsConsent | null {
  try {
    const raw = localStorage.getItem(DRIVER_GPS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriverGpsConsent>;
    if (typeof parsed.allowed !== 'boolean') return null;
    return {
      allowed: parsed.allowed,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeDriverGpsConsent(allowed: boolean): DriverGpsConsent {
  const next: DriverGpsConsent = { allowed, decidedAt: new Date().toISOString() };
  localStorage.setItem(DRIVER_GPS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export type GeoResult =
  | { ok: true; coords: { lat: number; lng: number } }
  | { ok: false; code: number; message: string };

export function requestDeviceLocation(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({
        ok: false,
        code: -1,
        message: 'Standortbestimmung wird von diesem Browser nicht unterstützt.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      (err) => {
        let message = 'Standort konnte nicht ermittelt werden.';
        if (err.code === err.PERMISSION_DENIED) {
          message = 'Standortzugriff wurde im Browser abgelehnt.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = 'Standort ist derzeit nicht verfügbar.';
        } else if (err.code === err.TIMEOUT) {
          message = 'Zeitüberschreitung bei der Standortabfrage.';
        }
        resolve({ ok: false, code: err.code, message });
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}
