import { describe, expect, it } from "vitest";
import {
  acceptGeocodeResult,
  addressHasHouseNumber,
  geocodePrecision,
} from "./geocode-quality";

describe("geocode quality", () => {
  it("erkennt Hausnummern", () => {
    expect(addressHasHouseNumber("Musterstraße 1, 30159 Hannover")).toBe(true);
    expect(addressHasHouseNumber("Hannover")).toBe(false);
  });

  it("nimmt ROOFTOP-Treffer an", () => {
    const decision = acceptGeocodeResult("Musterstraße 1, Hannover", {
      geometry: { location: { lat: 52.3759, lng: 9.732 }, location_type: "ROOFTOP" },
      types: ["street_address"],
    });
    expect(decision).toEqual({
      ok: true,
      lat: 52.3759,
      lng: 9.732,
      precision: "exact",
    });
  });

  it("lehnt Stadt-Treffer bei Hausnummer ab und schreibt nie 0/0", () => {
    expect(
      acceptGeocodeResult("Teststraße 5, Hannover", {
        geometry: { location: { lat: 52.37, lng: 9.73 }, location_type: "APPROXIMATE" },
        types: ["locality", "political"],
      }).ok,
    ).toBe(false);
    expect(
      acceptGeocodeResult("Irgendwo", {
        geometry: { location: { lat: 0, lng: 0 }, location_type: "ROOFTOP" },
      }),
    ).toEqual({ ok: false, reason: "null_island" });
    expect(geocodePrecision({ types: ["postal_code"] })).toBe("postal");
  });
});
