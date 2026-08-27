/** SSRF-Schutz: keine Loopback-, Privat- oder Metadata-Ziele aus Edge Functions. */

export function isPrivateOrLoopback(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower === "169.254.169.254") return true;
  if (lower === "metadata.google.internal") return true;
  if (lower === "metadata") return true;

  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number.parseInt(ipv4[1], 10);
    const b = Number.parseInt(ipv4[2], 10);
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
  }

  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;

  return false;
}

export function validateExternalUrl(input: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "Ungültige URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: `Protokoll ${parsed.protocol} nicht erlaubt – nur http(s)` };
  }
  if (!parsed.hostname) {
    return { ok: false, reason: "Hostname fehlt" };
  }
  if (isPrivateOrLoopback(parsed.hostname)) {
    return { ok: false, reason: "Private oder lokale Adressen sind aus Sicherheitsgründen nicht erlaubt" };
  }
  return { ok: true, url: parsed };
}

export function assertPublicHostname(hostname: string): void {
  const host = hostname.trim();
  if (!host) throw new Error("Hostname fehlt.");
  if (isPrivateOrLoopback(host)) {
    throw new Error("Private oder lokale Adressen sind aus Sicherheitsgründen nicht erlaubt.");
  }
}
