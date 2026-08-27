/** Volumen in m³. Maße in Millimetern — wie packmittel/artikel. */

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

export function parseOptionalMm(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(String(raw).replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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
