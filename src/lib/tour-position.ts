/**
 * Kartenpositionen von Tour-Stops — aus vorhandenen Sendungskoordinaten.
 *
 * Fahrer-GPS liegt getrennt in `driver_position` (siehe `src/lib/driver-gps.ts`).
 * Konvention im Projekt: `location_x` = Breitengrad, `location_y` = Längengrad.
 */

export type LatLng = { lat: number; lng: number };

export function shipmentCoordinates(
  locationX: number | null | undefined,
  locationY: number | null | undefined,
): LatLng | null {
  if (locationX == null || locationY == null) return null;
  if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return null;
  if (locationX < -90 || locationX > 90 || locationY < -180 || locationY > 180) return null;
  // 0/0 entsteht in der Praxis nur durch fehlende Werte (siehe `plan-tour`), nicht durch echte Adressen.
  if (locationX === 0 && locationY === 0) return null;
  return { lat: locationX, lng: locationY };
}

export type PositionStop = {
  id: string;
  stopNumber: number | null;
  confirmed: boolean;
  confirmedAt: string | null;
  customer: string;
  address: string | null;
  coordinates: LatLng | null;
};

export type TourAnchor = {
  stop: PositionStop;
  coordinates: LatLng;
  /** `confirmed` = vom Fahrer bestätigter Stop, `planned` = disponiert, noch nicht bestätigt. */
  kind: 'confirmed' | 'planned';
};

/**
 * Wählt den Stop, der die Tour auf der Karte verortet: den letzten bestätigten Stop mit
 * Koordinaten, sonst den nächsten offenen Stop mit Koordinaten. `stops` muss nach
 * `stop_index` sortiert sein. Ohne Koordinaten gibt es keinen Anker — dann wird nichts
 * geraten, die Tour erscheint stattdessen in der Liste ohne Position.
 */
export function pickTourAnchor(stops: PositionStop[]): TourAnchor | null {
  const located = stops.filter((stop) => stop.coordinates !== null);

  const lastConfirmed = [...located].reverse().find((stop) => stop.confirmed);
  if (lastConfirmed) {
    return { stop: lastConfirmed, coordinates: lastConfirmed.coordinates!, kind: 'confirmed' };
  }

  const nextOpen = located.find((stop) => !stop.confirmed);
  if (nextOpen) {
    return { stop: nextOpen, coordinates: nextOpen.coordinates!, kind: 'planned' };
  }

  return null;
}
