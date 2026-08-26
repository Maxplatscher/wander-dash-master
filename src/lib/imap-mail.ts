/** Reine Header-/Sendungsableitung für IMAP-Import. Keine Adressen erfinden. */

export type ParsedMailHeaders = {
  messageId: string | null;
  subject: string;
  from: string;
  date: string | null;
};

export function decodeMimeWord(value: string): string {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_all, _charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        const binary = atob(text.replace(/\s/g, ""));
        return new TextDecoder("utf-8", { fatal: false }).decode(
          Uint8Array.from(binary, (ch) => ch.charCodeAt(0)),
        );
      }
      const decoded = text
        .replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
      return decoded;
    } catch {
      return text;
    }
  });
}

export function parseImapHeaders(raw: string): ParsedMailHeaders {
  const unfolded = raw.replace(/\r\n[ \t]/g, " ");
  const get = (name: string): string | null => {
    const match = unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
    return match ? decodeMimeWord(match[1].trim()) : null;
  };
  const from = get("From") ?? "";
  const angle = from.match(/<([^>]+)>/);
  return {
    messageId: get("Message-ID") ?? get("Message-Id"),
    subject: (get("Subject") ?? "").trim() || "Ohne Betreff",
    from: (angle?.[1] ?? from).trim(),
    date: get("Date"),
  };
}

export function previewFromBody(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export function fallbackMessageId(companyId: string, headers: ParsedMailHeaders, preview: string): string {
  const basis = `${headers.from}|${headers.subject}|${headers.date ?? ""}|${preview.slice(0, 80)}`;
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `<dc-${companyId.slice(0, 8)}-${(hash >>> 0).toString(16)}@local>`;
}

export function shipmentDraftFromMail(input: {
  headers: ParsedMailHeaders;
  preview: string;
  serviceDate: string;
  companyId: string;
  depotId: string | null;
  integrationId?: string | null;
}): {
  company_id: string;
  name: string;
  seller_email: string | null;
  email_notes: string | null;
  raw_email: string;
  email_received_at: string;
  intake_source: "email_imap";
  intake_status: "new";
  service_date: string;
  depot_id: string | null;
  integration_id: string | null;
  customer_name: null;
  delivery_address: null;
  weight_kg: null;
  missing_fields: { needs_review: true };
} {
  const name = input.headers.subject.slice(0, 120);
  return {
    company_id: input.companyId,
    name,
    seller_email: input.headers.from || null,
    email_notes: input.preview.slice(0, 2000) || null,
    raw_email: input.preview.slice(0, 15000),
    email_received_at: new Date().toISOString(),
    intake_source: "email_imap",
    intake_status: "new",
    service_date: input.serviceDate,
    depot_id: input.depotId,
    integration_id: input.integrationId ?? null,
    customer_name: null,
    delivery_address: null,
    weight_kg: null,
    missing_fields: { needs_review: true },
  };
}
