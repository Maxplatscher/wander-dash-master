import { describe, expect, it } from "vitest";
import type { DepotOption } from "./depot";
import {
  openMeteoForecastUrl,
  resolveWeatherLocation,
} from "./weather-location";

function depot(partial: Partial<DepotOption> & Pick<DepotOption, "id" | "name">): DepotOption {
  return {
    code: null,
    city: null,
    lat: null,
    lng: null,
    is_active: true,
    ...partial,
  };
}

describe("weather location", () => {
  it("nimmt das gewählte Depot mit Koordinaten", () => {
    const selected = depot({
      id: "a",
      name: "Nord",
      city: "Hannover",
      lat: 52.37,
      lng: 9.73,
    });
    expect(resolveWeatherLocation(selected, [])).toEqual({
      lat: 52.37,
      lng: 9.73,
      label: "Hannover",
    });
  });

  it("fällt auf das erste Depot mit Koordinaten zurück und erfindet keine Lage", () => {
    const depots = [
      depot({ id: "empty", name: "Leer" }),
      depot({ id: "h", name: "Haupt", city: "Hannover", lat: 52.37, lng: 9.73 }),
    ];
    expect(resolveWeatherLocation(null, depots)?.label).toBe("Hannover");
    expect(resolveWeatherLocation(null, [depot({ id: "x", name: "X" })])).toBeNull();
    expect(
      resolveWeatherLocation(
        depot({ id: "zero", name: "Null", lat: 0, lng: 0 }),
        depots,
      ),
    ).toBeNull();
  });

  it("baut die Open-Meteo-URL ohne hartcodiertes München", () => {
    const url = openMeteoForecastUrl({ lat: 52.37, lng: 9.73, label: "Hannover" });
    expect(url).toContain("latitude=52.37");
    expect(url).toContain("longitude=9.73");
    expect(url).not.toContain("48.14");
  });
});
