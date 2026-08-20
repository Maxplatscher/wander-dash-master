import { useMemo, useState } from 'react';
import { Check, ExternalLink, Loader2, Pencil, Search, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import {
  ArticleSuggestion,
  UnknownArticleField,
  extractPositionArticles,
  parseMissingFields,
} from '@/lib/article-research';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Shipment = Tables<'shipment'>;

type Props = {
  shipments: Shipment[];
  dateStr: string;
};

type EditDraft = {
  length_mm: string;
  width_mm: string;
  height_mm: string;
  weight_kg: string;
};

function suggestionToDraft(s: ArticleSuggestion | null): EditDraft {
  return {
    length_mm: s?.length_mm != null ? String(s.length_mm) : '',
    width_mm: s?.width_mm != null ? String(s.width_mm) : '',
    height_mm: s?.height_mm != null ? String(s.height_mm) : '',
    weight_kg: s?.weight_kg != null ? String(s.weight_kg) : '',
  };
}

function parseNum(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null);
      if (body && typeof body.error === 'string') return body.error;
    }
  }
  return error instanceof Error ? error.message : 'Recherche fehlgeschlagen';
}

export function ArticleReviewPanel({ shipments, dateStr }: Props) {
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>(suggestionToDraft(null));

  const reviewItems = useMemo(() => {
    const items: { shipment: Shipment; article: UnknownArticleField }[] = [];
    for (const s of shipments) {
      const mf = parseMissingFields(s.missing_fields);
      for (const article of mf.unknown_articles ?? []) {
        if (article.status === 'pending') items.push({ shipment: s, article });
      }
    }
    return items;
  }, [shipments]);

  const scannable = useMemo(
    () => shipments.filter((s) => extractPositionArticles(s.positionen).length > 0),
    [shipments],
  );

  const { data: userRow } = useQuery({
    queryKey: ['current-public-user'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email;
      if (!email) return null;
      const { data, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['shipments', dateStr] });
  };

  const scanShipment = async (shipmentId: string) => {
    setBusyKey(`scan:${shipmentId}`);
    try {
      const { data, error } = await supabase.functions.invoke('research-article', {
        body: { action: 'scan_shipment', shipment_id: shipmentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const n = data?.unknown ?? 0;
      toast.success(n ? `${n} unbekannte Artikel recherchiert` : 'Keine unbekannten Artikel');
      invalidate();
    } catch (e) {
      toast.error(await functionErrorMessage(e));
    } finally {
      setBusyKey(null);
    }
  };

  const researchOne = async (shipment: Shipment, article: UnknownArticleField) => {
    setBusyKey(`research:${shipment.id}:${article.key}`);
    try {
      const { data, error } = await supabase.functions.invoke('research-article', {
        body: {
          action: 'research',
          shipment_id: shipment.id,
          name: article.name,
          artikelnummer: article.artikelnummer ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.known) {
        toast.message('Artikel bereits bestätigt');
      } else {
        toast.success('Vorschlag aktualisiert');
      }
      invalidate();
    } catch (e) {
      toast.error(await functionErrorMessage(e));
    } finally {
      setBusyKey(null);
    }
  };

  const updateMissingStatus = async (
    shipment: Shipment,
    key: string,
    status: 'confirmed' | 'dismissed' | 'pending',
    suggestion?: ArticleSuggestion | null,
  ) => {
    const mf = parseMissingFields(shipment.missing_fields);
    const list = (mf.unknown_articles ?? []).map((a) =>
      a.key === key
        ? { ...a, status, suggestion: suggestion !== undefined ? suggestion : a.suggestion }
        : a,
    );
    const { error } = await supabase
      .from('shipment')
      .update({ missing_fields: { ...mf, unknown_articles: list } })
      .eq('id', shipment.id);
    if (error) throw error;
  };

  const acceptArticle = async (
    shipment: Shipment,
    article: UnknownArticleField,
    values: EditDraft,
  ) => {
    setBusyKey(`accept:${shipment.id}:${article.key}`);
    try {
      const companyId = (await supabase.rpc('get_user_company_id')).data;
      if (!companyId) throw new Error('Keine company_id');

      const suggestion = article.suggestion;
      const row = {
        company_id: companyId,
        name: suggestion?.name?.trim() || article.name,
        artikelnummer: article.artikelnummer ?? null,
        length_mm: parseNum(values.length_mm),
        width_mm: parseNum(values.width_mm),
        height_mm: parseNum(values.height_mm),
        weight_kg: parseNum(values.weight_kg),
        quelle_url: suggestion?.quelle_url ?? null,
        bestaetigt_von: userRow?.id ?? null,
        bestaetigt_am: new Date().toISOString(),
      };

      const { error } = await supabase.from('artikel').insert(row);
      if (error) throw error;

      await updateMissingStatus(shipment, article.key, 'confirmed', {
        name: row.name,
        length_mm: row.length_mm,
        width_mm: row.width_mm,
        height_mm: row.height_mm,
        weight_kg: row.weight_kg,
        quelle_url: row.quelle_url,
        confidence: suggestion?.confidence ?? 1,
      });

      toast.success(`Artikel „${row.name}" übernommen`);
      setEditingKey(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Übernehmen fehlgeschlagen');
    } finally {
      setBusyKey(null);
    }
  };

  const dismissArticle = async (shipment: Shipment, article: UnknownArticleField) => {
    setBusyKey(`dismiss:${shipment.id}:${article.key}`);
    try {
      await updateMissingStatus(shipment, article.key, 'dismissed');
      toast.message('Vorschlag verworfen');
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setBusyKey(null);
    }
  };

  if (!reviewItems.length && !scannable.length) return null;

  return (
    <div className="rounded-sm border border-hairline bg-panel/80 p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <p className="card-title">Artikel-Review (KI-Recherche)</p>
        </div>
        <p className="meta-text mt-1">
          Unbekannte Positionen mit Quelle prüfen — erst nach Bestätigung in die Stammdaten.
        </p>
      </div>

      {scannable.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {scannable.slice(0, 5).map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant="outline"
              className="rounded h-8"
              disabled={busyKey === `scan:${s.id}`}
              onClick={() => void scanShipment(s.id)}
            >
              {busyKey === `scan:${s.id}` ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
              ) : (
                <Search className="w-3 h-3 mr-1.5" />
              )}
              Positionen prüfen · {s.name || s.id.slice(0, 8)}
            </Button>
          ))}
        </div>
      )}

      {reviewItems.length === 0 ? (
        <p className="meta-text text-dim">Keine offenen Artikel-Vorschläge.</p>
      ) : (
        <ul className="space-y-3">
          {reviewItems.map(({ shipment, article }) => {
            const rowKey = `${shipment.id}:${article.key}`;
            const isEditing = editingKey === rowKey;
            const s = article.suggestion;
            const conf =
              s?.confidence != null ? `${Math.round(s.confidence * 100)} %` : '—';

            return (
              <li
                key={rowKey}
                className="rounded-sm border border-hairline bg-white/[0.02] px-4 py-3 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{article.name}</p>
                    <p className="meta-text">
                      Sendung {shipment.name || shipment.id.slice(0, 8)}
                      {article.artikelnummer ? ` · Art.-Nr. ${article.artikelnummer}` : ''}
                      {' · '}Confidence {conf}
                    </p>
                  </div>
                  {s?.quelle_url && (
                    <a
                      href={s.quelle_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Quelle <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        ['length_mm', 'Länge mm'],
                        ['width_mm', 'Breite mm'],
                        ['height_mm', 'Höhe mm'],
                        ['weight_kg', 'Gewicht kg'],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field} className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-dim font-semibold">
                          {label}
                        </span>
                        <Input
                          value={draft[field]}
                          onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                          className="h-8 text-sm rounded bg-white/[0.03] border-hairline"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-mono">
                    {s
                      ? `${s.length_mm ?? '—'} × ${s.width_mm ?? '—'} × ${s.height_mm ?? '—'} mm · ${s.weight_kg ?? '—'} kg`
                      : 'Noch kein Vorschlag — Recherche starten'}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {!s && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded"
                      disabled={!!busyKey}
                      onClick={() => void researchOne(shipment, article)}
                    >
                      {busyKey === `research:${rowKey}` ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Search className="w-3 h-3 mr-1" />
                      )}
                      Recherchieren
                    </Button>
                  )}
                  {s && !isEditing && (
                    <>
                      <Button
                        size="sm"
                        className="h-8 rounded"
                        disabled={!!busyKey}
                        onClick={() =>
                          void acceptArticle(shipment, article, suggestionToDraft(s))
                        }
                      >
                        {busyKey === `accept:${rowKey}` ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Check className="w-3 h-3 mr-1" />
                        )}
                        Übernehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded"
                        disabled={!!busyKey}
                        onClick={() => {
                          setEditingKey(rowKey);
                          setDraft(suggestionToDraft(s));
                        }}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Manuell korrigieren
                      </Button>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <Button
                        size="sm"
                        className="h-8 rounded"
                        disabled={!!busyKey}
                        onClick={() => void acceptArticle(shipment, article, draft)}
                      >
                        {busyKey === `accept:${rowKey}` ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Check className="w-3 h-3 mr-1" />
                        )}
                        Speichern & übernehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded"
                        onClick={() => setEditingKey(null)}
                      >
                        Abbrechen
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded text-dim"
                    disabled={!!busyKey}
                    onClick={() => void dismissArticle(shipment, article)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Verwerfen
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
