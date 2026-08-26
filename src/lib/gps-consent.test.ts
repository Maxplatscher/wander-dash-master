import { describe, expect, it } from 'vitest';
import { hasAcknowledgedDriverGpsConsent, acknowledgeDriverGpsConsent, DRIVER_GPS_CONSENT_KEY } from './gps-consent';

describe('Fahrer-GPS-Einwilligung', () => {
  it('merkt sich die Bestätigung lokal', () => {
    localStorage.removeItem(DRIVER_GPS_CONSENT_KEY);
    expect(hasAcknowledgedDriverGpsConsent()).toBe(false);
    acknowledgeDriverGpsConsent();
    expect(hasAcknowledgedDriverGpsConsent()).toBe(true);
  });
});
