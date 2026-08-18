import type { Json } from '@/integrations/supabase/types';

export type ArticleSuggestion = {
  name: string;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  weight_kg: number | null;
  quelle_url: string | null;
  confidence: number | null;
};

export type UnknownArticleField = {
  key: string;
  name: string;
  artikelnummer?: string | null;
  suggestion: ArticleSuggestion | null;
  status: 'pending' | 'confirmed' | 'dismissed';
};

export type ShipmentMissingFields = {
  unknown_articles?: UnknownArticleField[];
};

export function parseMissingFields(raw: Json | null | undefined): ShipmentMissingFields {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const list = obj.unknown_articles;
  if (!Array.isArray(list)) return { unknown_articles: [] };
  return {
    unknown_articles: list.filter(
      (item): item is UnknownArticleField =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as UnknownArticleField).key === 'string' &&
        typeof (item as UnknownArticleField).name === 'string',
    ),
  };
}

export function articleKey(name: string, artikelnummer?: string | null): string {
  const n = name.trim().toLowerCase();
  const a = (artikelnummer ?? '').trim().toLowerCase();
  return a ? `${a}::${n}` : n;
}

/** Extrahiert Artikelnamen aus typischen positionen-JSON-Formen. */
export function extractPositionArticles(
  positionen: Json | null | undefined,
): { name: string; artikelnummer: string | null }[] {
  if (!positionen) return [];
  const rows = Array.isArray(positionen) ? positionen : [];
  const out: { name: string; artikelnummer: string | null }[] = [];

  for (const row of rows) {
    if (typeof row === 'string' && row.trim()) {
      out.push({ name: row.trim(), artikelnummer: null });
      continue;
    }
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const name = String(
      r.name ?? r.bezeichnung ?? r.artikel ?? r.artikelname ?? r.description ?? r.title ?? '',
    ).trim();
    if (!name) continue;
    const artikelnummer = String(
      r.artikelnummer ?? r.sku ?? r.artnr ?? r.article_number ?? r.nr ?? '',
    ).trim() || null;
    out.push({ name, artikelnummer });
  }

  return out;
}
