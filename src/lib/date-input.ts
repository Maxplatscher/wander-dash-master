/** Native <input type="date"> can emit "" or a partial value while typing. */

export function isValidDate(d: Date): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Local YYYY-MM-DD for date inputs and service_date queries. Invalid → today. */
export function toDateInputValue(d: Date): string {
  const src = isValidDate(d) ? d : new Date();
  const y = src.getFullYear();
  const m = String(src.getMonth() + 1).padStart(2, "0");
  const day = String(src.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Accepts only a complete calendar date. Incomplete typing and
 * impossible days (e.g. 2026-02-31) return null so callers keep the last valid Date.
 */
export function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0);
  if (
    !isValidDate(parsed) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function formatDateLabel(
  d: Date,
  options?: Intl.DateTimeFormatOptions,
  locale = "de-DE",
): string {
  return (isValidDate(d) ? d : new Date()).toLocaleDateString(locale, options);
}
