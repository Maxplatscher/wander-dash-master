# Prompt für Cursor: Einstellungen-Redesign aus Claude Design übernehmen

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter), Supabase-Projekt `sxqbmxqnwtrgibfryvqf`. Referenzscreenshots liegen unter `docs/design/einstellungen-scroll-oben.png` und `docs/design/einstellungen-scroll-unten.png` (in diesem Chat direkt öffnen und anschauen, bevor du loslegst).

## Ausgangslage

Max hat in einem separaten Prototyping-Tool ("Claude Design", ein Canvas mit Seiten Startseite/Kalender/Lieferscheine/Fahrer & Fahrzeuge/Einstellungen/Probleme) die Einstellungen-Seite optisch und funktional weiterentwickelt. Diese Änderungen landen **nicht** automatisch in diesem Repo — sie existieren nur als Screenshots. Aufgabe: die im Screenshot sichtbaren Änderungen in den echten Code übernehmen, nicht das Canvas-Tool selbst anfassen.

Ich (Claude, im selben Account) habe den aktuellen Code bereits gegen die Screenshots geprüft. Ergebnis in drei Teilen — bitte in dieser Reihenfolge abarbeiten, da Teil 3 mit Rücksprache läuft.

## Teil 1 — Design-Sektion: vermutlich schon fertig, nur gegenchecken

`src/components/settings/DesignSektion.tsx` + `src/lib/appearance.ts` bilden Akzentfarbe (4 Swatches: Cyan/Bernstein/Salbei/Stahlblau), Modus (Dunkel/Hell) und Informationsdichte (Kompakt/Ausgewogen/Luftig) bereits ab — inklusive CSS-Custom-Properties, `localStorage`-Persistenz (`dispatch-appearance`) und Tailwind-Anbindung über `hsl(var(--*))`. Das deckt sich mit dem oberen Bereich im Screenshot `einstellungen-scroll-oben.png` fast 1:1.

Bekannter Zustand im Code: **Hell-Modus ist deaktiviert** ("in Vorbereitung"). Bitte einmal gegen den Screenshot prüfen, ob der Hell-Button dort aktiv anklickbar wirkt oder ob im Prototyp ebenfalls nur "Dunkel" ausgewählt/aktiv war. Falls im Screenshot nichts auf einen funktionierenden Hell-Modus hindeutet: hier nichts ändern. Falls doch: kurz Rückmeldung an mich, das ist ein größeres Thema (fehlende Hell-Palette) und nicht Teil dieses Prompts.

## Teil 2 — "Lieferschein-Ordner": neue vereinfachte Card-Ansicht

Aktuell heißt der Block "System-Integrationen" (`src/components/settings/IntegrationenSektion.tsx`) und ist ein generischer Dialog-Editor für alle sechs `SystemType`s (`erp`, `telematics`, `email_imap`, `rest_api`, `csv_import`, `research_source`) mit Config-/Credential-Feldern, Verbindungstest, Depot-Zuordnung etc. Der Screenshot zeigt stattdessen eine deutlich simplere, dedizierte Ansicht nur für Lieferschein-Quellen:

- Überschrift „Lieferschein-Ordner" mit Badge „X verbunden" (Anzahl `is_active = true`).
- Eine Karte pro Quelle: Name, Quellangabe (z. B. `imap.example.com · INBOX/Lieferscheine` bzw. UNC-Pfad), rechts ein Dokumenten-Zähler + Zeitangabe („148 Dokumente / vor 4 Minuten"), Status-Badge (grün „aktiv" / gelb „wartet"), X zum Entfernen.
- Unten ein simples Formular: Feld „Bezeichnung" + Feld „Pfad oder Postfach" (ein zusammengefasstes Feld statt der granularen Config-Felder heute) + „Hinzufügen"-Button.

Drei Quellen im Screenshot, mit unterschiedlichem technischen Hintergrund — bitte pro Quelle unterscheiden:

1. **„Lieferscheine Posteingang"** (`imap.example.com · INBOX/Lieferscheine`, 148 Dokumente, aktiv) — das ist `system_type = 'email_imap'`, backend-seitig bereits real angebunden (`supabase/functions/fetch-imap`, `_shared/imap-mail.ts`). Hier ist "nur" die UI-Vereinfachung nötig.
2. **„Scanner Halle 2"** (`\\fileserver\scans\lieferscheine`, 62 Dokumente, aktiv) — ein Windows-UNC-Netzwerkpfad. **Dafür gibt es aktuell keinen `SystemType` und keine Möglichkeit, dass eine Supabase Edge Function direkt auf einen lokalen Firmen-Netzwerkpfad zugreift** (Edge Functions laufen in der Cloud, nicht im Firmennetz). Das würde einen lokalen Agenten/Dienst brauchen, der Dateien aktiv hochlädt. Bitte **nicht** stillschweigend als funktionsfähig implementieren — als offene Rückfrage markieren (z. B. Platzhalter-Karte, die ehrlich als "manuell/extern gepflegt" gekennzeichnet ist, bis geklärt ist, wie der Scanner tatsächlich andocken soll).
3. **„SFTP Partner Nord"** (`sftp.partner.example:/out/shipments/`, 0 Dokumente, wartet) — entspricht `system_type = 'csv_import'`, existiert im Schema/Formular, hat aber **keine** Fetch-Funktion (kein SFTP-Poll-Edge-Function). Als "wartet"-Zustand darstellbar (Konfiguration vorhanden, keine Daten), aber die eigentliche SFTP-Abholung ist ein separates, größeres Ticket — heute nicht bauen.

**Datenlücke Dokumenten-Zähler / "vor X Minuten":** Weder `system_integrations` noch `shipment`/`email_log` haben aktuell eine Verknüpfung, über die sich "Dokumente pro Quelle" zählen ließe (`shipment.intake_source` ist ein loses Textfeld, keine FK). Vorschlag:

```sql
ALTER TABLE public.shipment ADD COLUMN integration_id UUID REFERENCES public.system_integrations(id);
```

`fetch-imap` beim Insert von Sendungen mit der jeweiligen Integration-ID befüllen. Dokumenten-Zähler dann `count(*) from shipment where integration_id = X`, "zuletzt gelesen" `max(email_received_at)` bzw. Fallback auf `system_integrations.last_test_at`. Migration + Anpassung `fetch-imap` gehört noch zu Teil 2, aber bitte als eigenen, klar benannten Schritt/Commit, nicht mit der UI-Vereinfachung vermischen.

Technischer Rat: den bestehenden `useIntegrations`-Hook und die `system_integrations`-Tabelle weiterverwenden, nicht neu erfinden — nur eine zweite, einfachere UI-Komponente (`LieferscheinOrdnerSektion` o. ä.) obendrauf bauen, die auf `email_imap`/`csv_import` gefiltert ist. Den bisherigen generischen Dialog-Editor für die technischeren Typen (ERP, Telematik, REST, Recherchequelle) weiter unter einer eigenen Überschrift (z. B. weiterhin "System-Integrationen") behalten, damit nichts kaputtgeht, was `research-article` o. ä. gerade braucht.

## Teil 3 — "Hinweise an die KI" (`ai_hint`): komplett neues Feature, zwei Schritte

Repo-weite Suche nach `ai_hint`/„Hinweise an die KI" ergibt aktuell null Treffer — das ist laut Screenshot (`einstellungen-scroll-unten.png`) ein chatartiges Widget: Disponenten-Nachrichten rechts (blau, Label „DISPONENT"), KI-Antworten links (Label „KI"), Eingabefeld unten + „Senden", Fußzeile „X gespeicherte Hinweise · zuletzt heute HH:MM".

Ausdrücklich in zwei Schritten umsetzen (das war auch die Vorgabe aus der Design-Chat-Session selbst, siehe linke Spalte im Screenshot) — **vor Schritt 2 kurz mit mir abstimmen**, nicht direkt durchziehen:

**Schritt 1 (heute, nur UI + lokaler State):**
- Neue Komponente, in `Einstellungen.tsx` eingebettet, unterhalb von Teil 2.
- Chatverlauf als lokaler `useState`-Array `{ role: 'disponent' | 'ki'; text: string }[]`, kein DB-Zugriff.
- Eingabefeld + Senden-Button; beim Senden Disponenten-Nachricht anhängen, dann eine KI-Antwort generieren (welcher Endpoint dafür sinnvoll ist — vermutlich ein einfacher Call an eine bestehende oder neue Edge Function mit Gemini, ähnlich `ai-resolve` — bitte kurz vorschlagen, bevor fest verdrahtet wird) und ebenfalls anhängen. Antwortstil laut Screenshot: kurze Bestätigung, die den Hinweis in eine Regel übersetzt (Beispiel im Screenshot: "Notiert. Sendungen an Baustoffe Krüger bekommen ab jetzt ein Zeitfenster ab 09:00, auch wenn der Lieferschein früher angibt." — kein Platzhaltertext, echte Umformulierung).
- Fußzeile "X gespeicherte Hinweise · zuletzt HH:MM" aus der Länge des lokalen Arrays ableiten.

**Schritt 2 (erst nach kurzer Rückmeldung an mich):** Tabelle, RLS, echte Persistenz, Anbindung an die Tourenplanung.

```sql
CREATE TABLE public.ai_hint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  role TEXT NOT NULL CHECK (role IN ('disponent', 'ki')),
  text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
-- RLS analog zu den übrigen Tabellen (Muster: system_integrations-Policies, per-Company-Select/Insert für authenticated).
```

(Die `role`-Werte `'disponent'`/`'ki'` sind aus dem Chat-UI abgeleitet, im Screenshot war der CHECK-Constraint-Text abgeschnitten — bitte gegen das tatsächliche Bild nochmal verifizieren, falls sich beim Öffnen des Screenshots in Cursor andere Werte zeigen.)

Danach: UI von lokalem State auf echte Inserts/Selects gegen `ai_hint` umstellen; und `plan-tour` (Edge Function) so erweitern, dass aktive Hinweise (`is_active = true`) beim Planungslauf als zusätzlicher Kontext/Constraint berücksichtigt werden. Das überschneidet sich mit dem offenen Donnerstags-Punkt aus dem Wochenplan ("wie fließen zusätzliche Regeln in `plan-tour` ein, das aktuell nur `weight_kg`/`demand` kennt") — dafür bitte einen Konzeptvorschlag machen statt es blind zu verdrahten.

## Arbeitsweise

Reihenfolge: Teil 1 (nur Check, vermutlich kein Aufwand) → Teil 2 (UI + Migration, in sich abgeschlossen) → Teil 3 Schritt 1 (UI, lokal) → **Stopp, kurze Rückmeldung** → erst dann Teil 3 Schritt 2. Nach jedem Teil kurz testen und melden, nicht alles in einem Rutsch durchziehen.
