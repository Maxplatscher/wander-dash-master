import type { DepotOption } from "./depot";

export type WeatherLocation = {
  lat: number;
  lng: number;
  label: string;
};

export function hasUsableWeatherCoords(
  lat: number | null,
  lng: number | null,
): boolean {
  if (lat == null || lng == null) return false;
  if (lat === 0 && lng === 0) return false;
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/** Gewähltes Depot, sonst das erste Depot mit echten Koordinaten. Nie München-Platzhalter. */
export function resolveWeatherLocation(
  selected: DepotOption | null,
  depots: DepotOption[],
): WeatherLocation | null {
  const pool = selected ? [selected] : depots;
  const hit = pool.find((depot) => hasUsableWeatherCoords(depot.lat, depot.lng));
  if (!hit || hit.lat == null || hit.lng == null) return null;
  const label = hit.city?.trim() || hit.name;
  return { lat: hit.lat, lng: hit.lng, label };
}

export function openMeteoForecastUrl(location: WeatherLocation): string {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lng),
    current_weather: "true",
    hourly: "temperature_2m,weathercode,precipitation_probability",
    timezone: "Europe/Berlin",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}
