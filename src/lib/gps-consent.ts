export const LOCATION_CONSENT_LEGAL_TEXT =
  'Die Verarbeitung erfolgt auf Grundlage Ihrer Einwilligung gemäß DSGVO Art. 6 Abs. 1 lit. a. Sie können die Einwilligung jederzeit in den Einstellungen widerrufen. Ohne Standort bleibt DispoCenter nutzbar (manuelle Depot-/Adresseingabe).';

/** Fahrer: Widerruf ist „Standort stoppen“, nicht ein Einstellungs-Toggle. */
export const DRIVER_GPS_LEGAL_TEXT =
  'Die Verarbeitung erfolgt auf Grundlage Ihrer Einwilligung gemäß DSGVO Art. 6 Abs. 1 lit. a. Sie können die Einwilligung jederzeit mit „Standort stoppen“ widerrufen. Ohne Standort bleibt DispoCenter nutzbar — die Disposition sieht dann nur Stop-Lagen, keine Live-Position.';

export const DRIVER_GPS_CONSENT_KEY = 'dc_driver_gps_consent_ack';

export function hasAcknowledgedDriverGpsConsent(): boolean {
  try {
    return localStorage.getItem(DRIVER_GPS_CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function acknowledgeDriverGpsConsent() {
  try {
    localStorage.setItem(DRIVER_GPS_CONSENT_KEY, '1');
  } catch {
    // ignore
  }
}
