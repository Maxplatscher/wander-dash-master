export type HintConstraint =
  | { kind: 'earliest_window'; needle: string; time: string }
  | { kind: 'latest_window'; needle: string; time: string }
  | { kind: 'max_load'; needle: string; kg: number }
  | { kind: 'prefer_first'; needle: string }
  | { kind: 'prefer_last'; needle: string }
  | { kind: 'avoid'; needle: string }
  | { kind: 'note'; text: string };

export type AppliedHint = {
  kind: HintConstraint['kind'];
  needle?: string;
  text?: string;
  matched_shipments: number;
  matched_vehicles: number;
};

export type HintShipment = {
  id: string;
  customer_name: string | null;
  name: string | null;
  delivery_address?: string | null;
  window_start: string | null;
  window_end?: string | null;
  preferEarly?: boolean;
  deferEarly?: boolean;
  preferLate?: boolean;
};

export type HintVehicle = {
  id: string;
  name: string;
  capacity: number;
};

const STOPWORDS = new Set([
  'tour',
  'gestern',
  'heute',
  'morgen',
  'der',
  'die',
  'das',
  'ein',
  'eine',
  'und',
  'über',
  'ueber',
  'notiert',
]);

function extractTime(text: string): string | null {
  const match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

function extractKg(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function cleanNeedle(raw: string): string | null {
  const needle = raw
    .replace(/\b(tour|gestern|heute|morgen|notiert)\s*\d*/gi, ' ')
    .replace(/[:.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (needle.length < 3) return null;
  return needle;
}

function firstProperName(text: string): string | null {
  const matches = text.match(/[A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+)?/gu) ?? [];
  for (const match of matches) {
    if (STOPWORDS.has(match.split(/\s+/)[0].toLowerCase())) continue;
    if (match.length < 3) continue;
    return match;
  }
  return null;
}

function stripKnownPhrases(text: string): string {
  return text
    .replace(/notiert\.?/gi, '')
    .replace(/sendungen an/gi, '')
    .replace(/bei der tourenplanung gilt künftig:?/gi, '')
    .replace(/bekommen ab jetzt ein zeitfenster ab[^,.]*/gi, '')
    .replace(/auch wenn der lieferschein früher angibt\.?/gi, '')
    .replace(/nie vor[^,.]*/gi, '')
    .replace(/nicht vor[^,.]*/gi, '')
    .replace(/nie nach[^,.]*/gi, '')
    .replace(/nicht nach[^,.]*/gi, '')
    .replace(/spätestens[^,.]*/gi, '')
    .replace(/frühestens[^,.]*/gi, '')
    .replace(/,?\s*(die|der|das)\s+.+$/i, '')
    .replace(/^an\s+/i, '')
    .trim()
    .replace(/[.,]$/, '');
}

function constraintKey(constraint: HintConstraint): string {
  switch (constraint.kind) {
    case 'max_load':
      return `${constraint.kind}:${constraint.needle.toLowerCase()}:${constraint.kg}`;
    case 'earliest_window':
    case 'latest_window':
      return `${constraint.kind}:${constraint.needle.toLowerCase()}:${constraint.time}`;
    case 'note':
      return `${constraint.kind}:${constraint.text.toLowerCase()}`;
    default:
      return `${constraint.kind}:${constraint.needle.toLowerCase()}`;
  }
}

export function parseHintConstraint(text: string): HintConstraint {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { kind: 'note', text: '' };

  const time = extractTime(trimmed);
  const neverBefore = /nie vor|nicht vor|frühestens|erst (ab|nach)|zeitfenster ab/i.test(trimmed);
  if (time && neverBefore) {
    const needle = cleanNeedle(stripKnownPhrases(trimmed)) ?? firstProperName(trimmed);
    if (needle) return { kind: 'earliest_window', needle, time };
  }

  const neverAfter = /nie nach|nicht nach|spätestens|nicht später|zeitfenster bis/i.test(trimmed);
  if (time && neverAfter) {
    const needle = cleanNeedle(stripKnownPhrases(trimmed)) ?? firstProperName(trimmed);
    if (needle) return { kind: 'latest_window', needle, time };
  }

  const kg = extractKg(trimmed);
  const driverCap = /fährt keine|nicht mehr als|maximal|über \d|kapazität auf/i.test(trimmed);
  if (kg && driverCap) {
    const needle = firstProperName(trimmed);
    if (needle) return { kind: 'max_load', needle, kg };
  }

  if (/\b(zuerst|als erstes|als ersten|erster stopp|vorher angefahren)\b/i.test(trimmed)) {
    const needle = firstProperName(trimmed);
    if (needle) return { kind: 'prefer_first', needle };
  }

  if (/\b(zuletzt|als letztes|als letzten|letzter stopp|am ende)\b/i.test(trimmed)) {
    const needle = firstProperName(trimmed);
    if (needle) return { kind: 'prefer_last', needle };
  }

  if (/\b(nicht anfahren|meiden|keine (touren?|sendungen?) (zu|nach)|nicht mehr (zu|nach))\b/i.test(trimmed)) {
    const needle = firstProperName(trimmed) ?? cleanNeedle(stripKnownPhrases(trimmed));
    if (needle) return { kind: 'avoid', needle };
  }

  return { kind: 'note', text: trimmed };
}

export function parseHintConstraints(texts: string[]): HintConstraint[] {
  const seen = new Set<string>();
  const out: HintConstraint[] = [];
  for (const text of texts) {
    const constraint = parseHintConstraint(text);
    if (constraint.kind === 'note' && !constraint.text.trim()) continue;
    const key = constraintKey(constraint);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(constraint);
  }
  return out;
}

export function matchesNeedle(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack || !needle) return false;
  return haystack.toLocaleLowerCase('de-DE').includes(needle.toLocaleLowerCase('de-DE'));
}

export function hintAdjustedDistance(
  distance: number,
  preferEarly: boolean,
  deferEarly: boolean,
  stopCount: number,
  preferLate = false,
): number {
  let score = distance;
  if (preferEarly) score *= 0.35;
  if (preferLate) score *= 1.8;
  if (deferEarly && stopCount < 2) score += 80_000;
  if (preferLate && stopCount < 2) score += 50_000;
  return score;
}

function shipmentHaystack(shipment: HintShipment): string {
  return [shipment.customer_name, shipment.name, shipment.delivery_address].filter(Boolean).join(' ');
}

export function applyHintConstraints<S extends HintShipment, V extends HintVehicle>(
  shipments: S[],
  vehicles: V[],
  constraints: HintConstraint[],
  serviceDate: string,
): { shipments: S[]; vehicles: V[]; applied: AppliedHint[] } {
  const nextShipments = shipments.map((item) => ({ ...item }));
  const nextVehicles = vehicles.map((item) => ({ ...item }));
  const applied: AppliedHint[] = [];

  for (const constraint of constraints) {
    if (constraint.kind === 'earliest_window') {
      let matched = 0;
      for (const shipment of nextShipments) {
        if (!matchesNeedle(shipmentHaystack(shipment), constraint.needle)) continue;
        shipment.deferEarly = true;
        shipment.window_start = `${serviceDate}T${constraint.time}:00`;
        matched += 1;
      }
      applied.push({
        kind: constraint.kind,
        needle: constraint.needle,
        matched_shipments: matched,
        matched_vehicles: 0,
      });
    }

    if (constraint.kind === 'latest_window') {
      let matched = 0;
      for (const shipment of nextShipments) {
        if (!matchesNeedle(shipmentHaystack(shipment), constraint.needle)) continue;
        shipment.preferEarly = true;
        shipment.window_end = `${serviceDate}T${constraint.time}:00`;
        matched += 1;
      }
      applied.push({
        kind: constraint.kind,
        needle: constraint.needle,
        matched_shipments: matched,
        matched_vehicles: 0,
      });
    }

    if (constraint.kind === 'prefer_first') {
      let matched = 0;
      for (const shipment of nextShipments) {
        if (!matchesNeedle(shipmentHaystack(shipment), constraint.needle)) continue;
        shipment.preferEarly = true;
        matched += 1;
      }
      applied.push({
        kind: constraint.kind,
        needle: constraint.needle,
        matched_shipments: matched,
        matched_vehicles: 0,
      });
    }

    if (constraint.kind === 'prefer_last' || constraint.kind === 'avoid') {
      let matched = 0;
      for (const shipment of nextShipments) {
        if (!matchesNeedle(shipmentHaystack(shipment), constraint.needle)) continue;
        shipment.preferLate = true;
        matched += 1;
      }
      applied.push({
        kind: constraint.kind,
        needle: constraint.needle,
        matched_shipments: matched,
        matched_vehicles: 0,
      });
    }

    if (constraint.kind === 'max_load') {
      let matched = 0;
      for (const vehicle of nextVehicles) {
        if (!matchesNeedle(vehicle.name, constraint.needle)) continue;
        vehicle.capacity = Math.min(vehicle.capacity, Math.floor(constraint.kg));
        matched += 1;
      }
      applied.push({
        kind: constraint.kind,
        needle: constraint.needle,
        matched_shipments: 0,
        matched_vehicles: matched,
      });
    }

    if (constraint.kind === 'note') {
      applied.push({
        kind: 'note',
        text: constraint.text,
        matched_shipments: 0,
        matched_vehicles: 0,
      });
    }
  }

  return { shipments: nextShipments, vehicles: nextVehicles, applied };
}
