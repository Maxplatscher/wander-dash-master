export type DriverAssignment = {
  id: string;
  assigned_vehicle_id: string | null;
};

/**
 * Welcher Fahrer bekommt die geplante Tour?
 * 1. Fahrer, dem genau dieses Fahrzeug fest zugeordnet ist.
 * 2. Sonst der einzige noch freie Fahrer der Firma — bei mehreren ohne Zuordnung
 *    raten wir nicht (Meine Tour bleibt leer, statt die falsche Person zu treffen).
 */
export function resolveTourDriverId(
  vehicleId: string,
  drivers: DriverAssignment[],
  usedDriverIds: Set<string>,
): string | null {
  const byVehicle = drivers.find(
    (driver) => driver.assigned_vehicle_id === vehicleId && !usedDriverIds.has(driver.id),
  );
  if (byVehicle) return byVehicle.id;

  const free = drivers.filter((driver) => !usedDriverIds.has(driver.id));
  if (free.length === 1) return free[0].id;
  return null;
}
