export type ParsedMailHeaders = {
  messageId: string | null;
  subject: string;
  from: string;
  date: string | null;
};

export type ParsedShipmentFields = {
  customer_name: string | null;
  delivery_address: string | null;
  weight_kg: number | null;
};

export function decodeMimeWord(value: string): string {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_all, _charset, encoding, text) => {
    try {
      if (String(encoding).toUpperCase() === 'B') {
        const binary = atob(String(text).replace(/\s/g, ''));
        return new TextDecoder('utf-8', { fatal: false }).decode(
          Uint8Array.from(binary, (ch) => ch.charCodeAt(0)),
        );
      }
      const decoded = String(text)
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
      return decoded;
    } catch {
      return String(text);
    }
  });
}

export function parseImapHeaders(raw: string): ParsedMailHeaders {
  const unfolded = raw.replace(/\r\n[ \t]/g, ' ');
  const get = (name: string): string | null => {
    const match = unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'));
    return match ? decodeMimeWord(match[1].trim()) : null;
  };
  const from = get('From') ?? '';
  const angle = from.match(/<([^>]+)>/);
  return {
    messageId: get('Message-ID') ?? get('Message-Id'),
    subject: (get('Subject') ?? '').trim() || 'Ohne Betreff',
    from: (angle?.[1] ?? from).trim(),
    date: get('Date'),
  };
}

export function previewFromBody(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

const STREET_RE =
  /([A-ZÄÖÜa-zäöüß][A-Za-zÄÖÜäöüß.\- ]{2,40}(?:straße|strasse|str\.|weg|platz|allee|ring|gasse|damm))\s+(\d+[a-zA-Z]?)/i;
const PLZ_CITY_RE = /\b(\d{5})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{1,40})/;
const WEIGHT_RE = /\b(\d{1,5}(?:[.,]\d{1,2})?)\s*kg\b/i;
const CUSTOMER_RE = /(?:kunde|firma|empfaenger|empfänger|an)\s*[:\-]\s*(.+)/i;

export function parseShipmentFieldsFromMail(subject: string, body: string): ParsedShipmentFields {
  const text = `${subject}\n${body}`.replace(/\s+/g, ' ').trim();
  const street = text.match(STREET_RE);
  const plzCity = text.match(PLZ_CITY_RE);
  let delivery_address: string | null = null;
  if (street && plzCity) {
    delivery_address = `${street[1].trim()} ${street[2].trim()}, ${plzCity[1]} ${plzCity[2].trim()}`;
  } else if (street) {
    delivery_address = `${street[1].trim()} ${street[2].trim()}`;
  } else if (plzCity) {
    delivery_address = `${plzCity[1]} ${plzCity[2].trim()}`;
  }

  const weightMatch = text.match(WEIGHT_RE);
  const weight_kg = weightMatch ? Math.round(Number(weightMatch[1].replace(',', '.'))) : null;

  let customer_name: string | null = null;
  const labeled = `${subject}\n${body}`.match(CUSTOMER_RE);
  if (labeled?.[1]) {
    customer_name = labeled[1].split(/[\n,;]/)[0].trim().slice(0, 120) || null;
  }
  if (!customer_name) {
    const fromSubject = subject.replace(/^(aw|re|wg|fwd)\s*:\s*/i, '').trim();
    if (fromSubject && !STREET_RE.test(fromSubject) && fromSubject.length <= 80) {
      customer_name = fromSubject.slice(0, 120);
    }
  }

  return {
    customer_name,
    delivery_address,
    weight_kg: Number.isFinite(weight_kg) && (weight_kg ?? 0) > 0 ? weight_kg : null,
  };
}

export function fallbackMessageId(companyId: string, headers: ParsedMailHeaders, preview: string): string {
  const basis = `${headers.from}|${headers.subject}|${headers.date ?? ''}|${preview.slice(0, 80)}`;
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `<dc-${companyId.slice(0, 8)}-${(hash >>> 0).toString(16)}@local>`;
}
