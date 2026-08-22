export type GeocodePrecision = "exact" | "street" | "postal" | "area";

export type GoogleGeocodeResult = {
  formatted_address?: string;
  partial_match?: boolean;
  geometry?: {
    location?: { lat: number; lng: number };
    location_type?: string;
  };
  types?: string[];
};

export function addressHasHouseNumber(address: string): boolean {
  return /\d+[a-zA-Z]?/.test(address);
}

export function geocodePrecision(result: GoogleGeocodeResult): GeocodePrecision {
  const locationType = result.geometry?.location_type ?? "";
  const types = result.types ?? [];
  if (
    locationType === "ROOFTOP" ||
    types.includes("street_address") ||
    types.includes("premise") ||
    types.includes("subpremise")
  ) {
    return "exact";
  }
  if (locationType === "RANGE_INTERPOLATED" || types.includes("route")) {
    return "street";
  }
  if (types.includes("postal_code")) return "postal";
  return "area";
}

export type GeocodeDecision =
  | { ok: true; lat: number; lng: number; precision: GeocodePrecision }
  | { ok: false; reason: "no_geometry" | "null_island" | "too_coarse" };

export function acceptGeocodeResult(
  address: string,
  result: GoogleGeocodeResult,
): GeocodeDecision {
  const location = result.geometry?.location;
  if (
    location == null ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    return { ok: false, reason: "no_geometry" };
  }
  if (location.lat === 0 && location.lng === 0) {
    return { ok: false, reason: "null_island" };
  }
  const precision = geocodePrecision(result);
  if (precision === "area" && addressHasHouseNumber(address)) {
    return { ok: false, reason: "too_coarse" };
  }
  return {
    ok: true,
    lat: location.lat,
    lng: location.lng,
    precision,
  };
}
