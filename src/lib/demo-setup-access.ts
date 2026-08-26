/**
 * demo-setup darf nur interne Demo-Mandanten anfassen (Name „Demo A“, „Demo B“, …).
 * Kundenfirmen — auch Testmandanten wie Eisenvater — sehen den Button nicht.
 */
export function isInternalDemoCompany(name: string | null | undefined): boolean {
  return /^Demo\s+[A-Z0-9]+$/i.test((name ?? '').trim());
}

export function shouldShowDemoSetup(companyName: string | null | undefined): boolean {
  return isInternalDemoCompany(companyName);
}
