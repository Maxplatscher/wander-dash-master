/** Keep in sync with src/lib/csv-import.ts */
export type CsvShipmentDraft = {
  name: string;
  customer_name: string | null;
  delivery_address: string | null;
  weight_kg: number | null;
  service_date: string | null;
};

const HEADER_ALIASES: Record<string, keyof CsvShipmentDraft | 'skip'> = {
  kunde: 'customer_name',
  customer: 'customer_name',
  customer_name: 'customer_name',
  firma: 'customer_name',
  adresse: 'delivery_address',
  address: 'delivery_address',
  delivery_address: 'delivery_address',
  lieferadresse: 'delivery_address',
  gewicht: 'weight_kg',
  weight: 'weight_kg',
  weight_kg: 'weight_kg',
  kg: 'weight_kg',
  datum: 'service_date',
  date: 'service_date',
  service_date: 'service_date',
  lieferschein: 'name',
  name: 'name',
  sendung: 'name',
  nr: 'name',
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    if ((ch === ';' || ch === '\t') && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs >= commas && tabs >= semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\ufeff/, '');
}

export function parseCsvShipments(raw: string, fallbackDate: string): CsvShipmentDraft[] {
  const text = raw.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const split = (line: string) =>
    delimiter === ','
      ? splitCsvLine(line)
      : line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const headers = split(lines[0]).map(normalizeHeader);
  const mapped = headers.map((h) => HEADER_ALIASES[h] ?? null);

  const rows: CsvShipmentDraft[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const draft: CsvShipmentDraft = {
      name: '',
      customer_name: null,
      delivery_address: null,
      weight_kg: null,
      service_date: fallbackDate,
    };
    mapped.forEach((key, index) => {
      if (!key || key === 'skip') return;
      const value = (cells[index] ?? '').trim();
      if (!value) return;
      if (key === 'weight_kg') {
        const n = Number.parseFloat(value.replace(',', '.').replace(/[^\d.]/g, ''));
        draft.weight_kg = Number.isFinite(n) ? Math.round(n) : null;
      } else if (key === 'service_date') {
        draft.service_date = value.slice(0, 10);
      } else {
        draft[key] = value.slice(0, key === 'delivery_address' ? 2000 : 300);
      }
    });
    if (!draft.customer_name && !draft.delivery_address && !draft.name) continue;
    if (!draft.name) {
      draft.name = draft.customer_name || draft.delivery_address || 'CSV-Sendung';
    }
    rows.push(draft);
  }
  return rows;
}
