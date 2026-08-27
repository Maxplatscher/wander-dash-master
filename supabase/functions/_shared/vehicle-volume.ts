/** Keep in sync with src/lib/vehicle-volume.ts — Edge Functions cannot import from src/. */

export function cubicMetersFromMm(
  lengthMm: number | null | undefined,
  widthMm: number | null | undefined,
  heightMm: number | null | undefined,
): number | null {
  if (
    lengthMm == null ||
    widthMm == null ||
    heightMm == null ||
    lengthMm <= 0 ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    return null;
  }
  return (lengthMm * widthMm * heightMm) / 1_000_000_000;
}

export function volumeFromArticleLike(
  items: Array<{
    length_mm?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
    qty?: number | null;
  }>,
): number | null {
  let total = 0;
  let any = false;
  for (const item of items) {
    const m3 = cubicMetersFromMm(item.length_mm, item.width_mm, item.height_mm);
    if (m3 == null) continue;
    const qty = item.qty != null && item.qty > 0 ? item.qty : 1;
    total += m3 * qty;
    any = true;
  }
  return any ? total : null;
}

export function shipmentFitsVehicle(params: {
  remainingKg: number;
  remainingM3: number | null;
  shipmentKg: number;
  shipmentM3: number | null;
}): boolean {
  if (params.shipmentKg > params.remainingKg) return false;
  if (params.remainingM3 == null || params.shipmentM3 == null) return true;
  return params.shipmentM3 <= params.remainingM3 + 1e-9;
}

export function volumeFromShipmentJson(
  missingFields: unknown,
  positionen: unknown,
): number | null {
  const items: Array<{
    length_mm?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
    qty?: number | null;
  }> = [];

  if (missingFields && typeof missingFields === "object" && !Array.isArray(missingFields)) {
    const list = (missingFields as { unknown_articles?: unknown }).unknown_articles;
    if (Array.isArray(list)) {
      for (const raw of list) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as {
          status?: string;
          suggestion?: { length_mm?: number | null; width_mm?: number | null; height_mm?: number | null };
          length_mm?: number | null;
          width_mm?: number | null;
          height_mm?: number | null;
        };
        const src = row.suggestion ?? row;
        items.push({
          length_mm: src.length_mm ?? null,
          width_mm: src.width_mm ?? null,
          height_mm: src.height_mm ?? null,
          qty: 1,
        });
      }
    }
  }

  if (Array.isArray(positionen)) {
    for (const raw of positionen) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as {
        length_mm?: number | null;
        width_mm?: number | null;
        height_mm?: number | null;
        qty?: number | null;
        menge?: number | null;
      };
      items.push({
        length_mm: row.length_mm ?? null,
        width_mm: row.width_mm ?? null,
        height_mm: row.height_mm ?? null,
        qty: row.qty ?? row.menge ?? 1,
      });
    }
  }

  return volumeFromArticleLike(items);
}
