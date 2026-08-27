export type OnboardingIndustry =
  | 'spedition'
  | 'logistik'
  | 'kurier'
  | 'lager'
  | 'sonstiges';

export const INDUSTRY_LABELS: Record<OnboardingIndustry, string> = {
  spedition: 'Spedition',
  logistik: 'Logistik',
  kurier: 'Kurier / Express',
  lager: 'Lager / Fulfillment',
  sonstiges: 'Sonstiges',
};

export type CompanyStepData = {
  companyName: string;
  industry: OnboardingIndustry | '';
  address: string;
  postalCode: string;
  city: string;
  country: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** Nach Speichern gesetzt */
  companyId: string | null;
  depotId: string | null;
};

export type FleetDriverDraft = {
  key: string;
  /** Vollname (Vor- + Nachname), für DB-Spalte `driver.name` */
  name: string;
  phone: string;
  personnelNumber: string;
  /** ISO-Datum `YYYY-MM-DD` oder leer */
  birthDate: string;
  /** Lokale Preview-URL / später Storage-Pfad; null = kein Foto */
  photoUrl: string | null;
  /** Draft-Key des zugewiesenen Fahrzeugs aus Schritt 2 */
  assignedVehicleKey: string | null;
  notes: string;
  /** Login-Mail — nach Speichern wird ein Fahrer-Account angelegt. */
  email: string;
};

export type FleetVehicleDraft = {
  key: string;
  name: string;
  capacity: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
};

export type FleetStepData = {
  drivers: FleetDriverDraft[];
  vehicles: FleetVehicleDraft[];
};

export function emptyFleetDriver(key?: string): FleetDriverDraft {
  return {
    key: key ?? newDraftKey('d'),
    name: '',
    phone: '',
    personnelNumber: '',
    birthDate: '',
    photoUrl: null,
    assignedVehicleKey: null,
    notes: '',
    email: '',
  };
}

function normalizeFleetDriver(raw: Partial<FleetDriverDraft> | undefined): FleetDriverDraft {
  const base = emptyFleetDriver(raw?.key);
  if (!raw) return base;
  return {
    ...base,
    key: raw.key ?? base.key,
    name: raw.name ?? '',
    phone: raw.phone ?? '',
    personnelNumber: raw.personnelNumber ?? '',
    birthDate: raw.birthDate ?? '',
    photoUrl: raw.photoUrl ?? null,
    assignedVehicleKey: raw.assignedVehicleKey ?? null,
    notes: raw.notes ?? '',
    email: raw.email ?? '',
  };
}

export type OnboardingRole = 'admin' | 'dispatcher' | 'driver';

export const ROLE_LABELS: Record<OnboardingRole, string> = {
  admin: 'Admin',
  dispatcher: 'Disponent',
  driver: 'Fahrer',
};

export type PersonalStepData = {
  fullName: string;
  email: string;
  phone: string;
  role: OnboardingRole;
};

export type OnboardingDraft = {
  step: number;
  company: CompanyStepData;
  fleet: FleetStepData;
  personal: PersonalStepData;
  themeName: string;
};

export const ONBOARDING_DRAFT_KEY = 'dc_onboarding_draft_v1';

export function emptyCompanyStep(): CompanyStepData {
  return {
    companyName: '',
    industry: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'DE',
    placeId: null,
    lat: null,
    lng: null,
    companyId: null,
    depotId: null,
  };
}

export function emptyFleetVehicle(key?: string): FleetVehicleDraft {
  return {
    key: key ?? newDraftKey('v'),
    name: '',
    capacity: '',
    lengthMm: '',
    widthMm: '',
    heightMm: '',
  };
}

function normalizeFleetVehicle(raw: Partial<FleetVehicleDraft> | undefined): FleetVehicleDraft {
  const base = emptyFleetVehicle(raw?.key);
  if (!raw) return base;
  return {
    ...base,
    key: raw.key ?? base.key,
    name: raw.name ?? '',
    capacity: raw.capacity ?? '',
    lengthMm: raw.lengthMm ?? '',
    widthMm: raw.widthMm ?? '',
    heightMm: raw.heightMm ?? '',
  };
}

export function emptyFleetStep(): FleetStepData {
  return {
    drivers: [],
    vehicles: [emptyFleetVehicle('v1')],
  };
}

export function emptyPersonalStep(email = ''): PersonalStepData {
  return {
    fullName: '',
    email,
    phone: '',
    role: 'admin',
  };
}

export function newDraftKey(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function readOnboardingDraft(): OnboardingDraft | null {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    const fleetRaw = parsed.fleet;
    const fleet: FleetStepData = fleetRaw
      ? {
          drivers: (fleetRaw.drivers ?? []).map((d) => normalizeFleetDriver(d)),
          vehicles: fleetRaw.vehicles?.length
            ? fleetRaw.vehicles.map((v) => normalizeFleetVehicle(v))
            : emptyFleetStep().vehicles,
        }
      : emptyFleetStep();

    return {
      step: parsed.step ?? 1,
      company: parsed.company ?? emptyCompanyStep(),
      fleet,
      personal: parsed.personal ?? emptyPersonalStep(),
      themeName: parsed.themeName ?? 'Teal (Standard)',
    };
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(draft: OnboardingDraft) {
  sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

export function clearOnboardingDraft() {
  sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
}

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

/** street_number + route → Adresszeile; postal_code, locality/postal_town */
export function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): { address: string; postalCode: string; city: string; country: string } {
  if (!components?.length) {
    return { address: '', postalCode: '', city: '', country: 'DE' };
  }

  const get = (type: string) => components.find((c) => c.types.includes(type))?.long_name ?? '';
  const streetNumber = get('street_number');
  const route = get('route');
  const address = [route, streetNumber].filter(Boolean).join(' ').trim();
  const postalCode = get('postal_code');
  const city = get('locality') || get('postal_town') || get('sublocality') || get('administrative_area_level_2');
  const countryShort = components.find((c) => c.types.includes('country'))?.short_name ?? 'DE';

  return {
    address,
    postalCode,
    city,
    country: countryShort || 'DE',
  };
}
