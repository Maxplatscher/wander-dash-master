# Feature-Prompt für Cursor: Artikel-Stammdaten mit KI-Websuche + Branchen-Recherchequelle

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter). `docs/CLAUDE_PROJECT_PROMPT.md` gilt weiterhin als Basis.

## Kontext / Ziel

DispoCenter soll pro Unternehmen einen eigenen Artikel- und Packmittel-Stammdatenbestand aufbauen, der für millimetergenaue Tourenplanung (Maße, Gewicht, Stapelbarkeit) gebraucht wird. Da Branchen komplett unterschiedlich sind (Baustoffhandel, Medikamentenhandel, ...), gibt es **keinen** globalen Katalog — jedes Unternehmen pflegt seinen eigenen, der sich beim Verarbeiten von Lieferscheinen selbst aufbaut: Bei einem unbekannten Artikel sucht die KI selbstständig im Web nach Maßen/Gewicht, schlägt das Ergebnis **mit Quelle** vor, ein Mensch bestätigt einmalig — danach ist der Artikel dauerhaft bekannt. Kein Blind-Übernehmen ungeprüfter Web-Treffer, gerade bei sicherheits-/complianceрелevanten Branchen (z. B. Pharma).

## Baustein 1 — Branchen-Website als Recherchequelle (kein neues Schema nötig)

Es gibt bereits ein vollständiges Integrationen-System: `public.system_integrations` + `src/types/integrations.ts` (`SystemType`, `CONFIG_FIELDS`, `CREDENTIAL_FIELDS`, `TYPE_LABELS`, `TYPE_ICONS`) + UI in `src/components/settings/IntegrationenSektion.tsx`. Das wiederverwenden statt neu bauen:

1. In `src/types/integrations.ts` einen neuen `SystemType` ergänzen, z. B. `'research_source'`.
2. `CONFIG_FIELDS.research_source = ['base_url']` (optional zusätzlich `'notiz'`).
3. `CREDENTIAL_FIELDS.research_source = []` (keine Zugangsdaten nötig, öffentliche Website).
4. `TYPE_LABELS.research_source = 'Branchen-Website (Recherchequelle)'`, passendes Icon in `TYPE_ICONS`.
5. Damit funktioniert Anlegen/Bearbeiten/Löschen sofort über die bestehende `IntegrationenSektion.tsx` — keine neue UI nötig. Ein Unternehmen kann mehrere Recherchequellen hinterlegen (z. B. Hersteller-Website + Großhändler-Katalog).

## Baustein 2 — Artikel- und Packmittel-Stammdaten (neue Tabellen, per Migration)

```sql
CREATE TABLE public.packmittel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id),
  name TEXT NOT NULL,
  length_mm INTEGER,
  width_mm INTEGER,
  height_mm INTEGER,
  max_weight_kg NUMERIC,
  stackable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.artikel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id),
  name TEXT NOT NULL,
  artikelnummer TEXT,
  packmittel_id UUID REFERENCES public.packmittel(id),
  length_mm INTEGER,
  width_mm INTEGER,
  height_mm INTEGER,
  weight_kg NUMERIC,
  quelle_url TEXT,              -- Web-Quelle des KI-Vorschlags, falls so entstanden
  bestaetigt_von UUID REFERENCES public.users(id),
  bestaetigt_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS auf beiden Tabellen im bestehenden Muster (`company_id = get_user_company_id()`, siehe `driver`/`vehicle`-Policies als Vorlage — **nicht** das kaputte `auth.users`-Muster verwenden, das in dieser Session bereits auf `users`/`depot` gefixt wurde).

Beim Onboarding (`StepFleet.tsx`-Nachbarschaft) `packmittel` mit ein paar Standard-Vorlagen vorbefüllen (Europalette 800×1200×144mm, Gitterbox, 2–3 gängige Kartongrößen) — frei löschbar/editierbar, keine Pflicht.

## Baustein 3 — Edge Function `research-article`

Neue Function, ausgelöst wenn beim Verarbeiten eines Lieferscheins (bestehende E-Mail-Pipeline, `email_log`/`shipment.positionen`) ein Artikelname auftaucht, der noch nicht in `public.artikel` der Company existiert:

1. Aktive `system_integrations` mit `system_type = 'research_source'` der Company laden.
2. Websuche zum Artikelnamen/zur Artikelnummer durchführen — **bevorzugt** auf den hinterlegten Branchen-Websites (Site-eingeschränkte Suche), sonst allgemeine Websuche als Fallback.
3. **Wichtiger Entscheidungspunkt, bitte vor Umsetzung klären:** Es gibt aktuell keine Websuche-Anbindung im Projekt. Optionen: (a) Gemini/Lovable-AI-Gateway mit Google-Search-Grounding, falls von Lovable AI unterstützt, oder (b) dedizierte Such-API (z. B. Tavily, Serper). Bitte mit dem Team klären, bevor ein Provider fest verdrahtet wird.
4. Ergebnis **nicht** direkt in `artikel` schreiben, sondern als Vorschlag zurückgeben: `{ name, length_mm, width_mm, height_mm, weight_kg, quelle_url, confidence }`.
5. Vorschlag landet in der UI zur Ein-Klick-Bestätigung (siehe Baustein 4) — erst nach Bestätigung wird `bestaetigt_von`/`bestaetigt_am` gesetzt und der Artikel gilt als „bekannt".

## Baustein 4 — Bestätigungs-UI

Nutzt das bereits im Schema vorhandene, aber bisher nirgends in der UI ausgewertete Feld `shipment.missing_fields` (jsonb) als Ausgangspunkt — dort offene/unsichere Felder samt KI-Vorschlag ablegen. Neue kleine Review-Komponente (vermutlich in `Kontrollzentrale.tsx` / „Lieferscheine & mehr", da dort Lieferscheine ohnehin geprüft werden): pro offenem Artikel Vorschlag mit Quelle anzeigen, „Übernehmen" / „Manuell korrigieren"-Buttons.

## Arbeitsweise

Reihenfolge: Baustein 1 (Integrationstyp, schnell) → kurze Rückmeldung → Baustein 2 (Migration) → Rückmeldung → Baustein 3 **erst nach Klärung des Such-Providers** → Baustein 4. Nicht alles auf einmal umsetzen.
