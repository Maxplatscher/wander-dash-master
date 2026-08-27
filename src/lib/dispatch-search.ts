export function normalizeSearchQuery(query: string | null | undefined): string {
  return (query ?? '').trim().toLowerCase();
}

export function matchesSearch(
  query: string | null | undefined,
  ...parts: Array<string | number | null | undefined>
): boolean {
  const needle = normalizeSearchQuery(query);
  if (!needle) return true;
  return parts.some((part) => String(part ?? '').toLowerCase().includes(needle));
}
