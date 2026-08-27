/** Keep in sync with src/lib/driver-name.ts */

export function normalizeDriverName(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function joinPersonName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function loginNameKey(firstName: string, lastName: string): string {
  return normalizeDriverName(joinPersonName(firstName, lastName));
}

export function isValidLoginCode(value: string): boolean {
  return /^\d{4,5}$/.test(value.trim());
}

/** 5-stelliger Code 10000–99999, kryptografisch zufällig. */
export function generateLoginCode(): string {
  const min = 10000;
  const max = 99999;
  const range = max - min + 1;
  const maxUnbiased = Math.floor(0xffffffff / range) * range;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= maxUnbiased);
  return String(min + (buf[0] % range));
}
