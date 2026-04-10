

# Probleme-Seite: Interaktive Detailansichten + KI-gesteuerte Problemlösung

## Überblick

Jedes Problem in der Liste wird klickbar und öffnet einen Detail-Dialog mit kontextspezifischen Aktionen. Kapazitätsüberschreitungen werden automatisch von der KI gelöst. Probleme werden aus echten DB-Daten generiert statt aus statischen Dummy-Daten.

## Änderungen

### 1. `src/pages/dispatch/Probleme.tsx` — Kompletter Neubau

**Dynamische Probleme aus DB statt statischer Liste:**
- `useProblems(date)` Hook: Prüft `shipment` (ohne Tour-Zuordnung), `tour_stop` (Zeitkonflikte), `tour` + `vehicle` (Kapazität), `driver` (Abwesenheiten), `email_log` (unvollständige Emails)
- Fallback auf Demo-Daten wenn DB leer

**Klick auf Problem öffnet Dialog (`Sheet` oder `Dialog`) mit spezifischem Inhalt:**

| Problem-Typ | Dialog-Inhalt |
|---|---|
| **Sendungen ohne Tour** | Liste der unzugeordneten Sendungen mit Details (Name, Adresse, Gewicht). Dropdown zur manuellen Zuordnung zu bestehender Tour. Button "Neue Tour erstellen" (Insert in `tour` + `tour_stop`). Button "KI zuordnen lassen" (ruft `plan-tour` Edge Function). |
| **Zeitfensterkonflikt** | Zeigt betroffene Stops mit Zeitfenstern. Verkehrshinweise für die Region. Grund-Analyse: vorherige Abladezeit, Fahrzeit, Verkehrslage. Button "KI-Umplanung" → ruft `plan-tour` auf. |
| **Kapazitätsüberschreitung** | Zeigt Fahrzeug-Limit vs. tatsächliches Gewicht. **Automatisch**: KI-Banner "Wird automatisch umgeplant". Button "Jetzt umplanen" → ruft `plan-tour`. Diese Probleme dürfen nicht bestehen bleiben. |
| **Fahrer abwesend** | Zeigt Fahrer-Info, betroffene Touren. Liste verfügbarer Vertretungsfahrer. Button "Vertretung zuweisen". |
| **E-Mails unvollständig** | Zeigt Email-Details aus `email_log`. Fehlende Felder hervorgehoben. Manuelles Formular zum Ergänzen. |

**Filter-Tabs werden funktional:** Klick filtert die Liste nach Typ.

### 2. Neue Edge Function `supabase/functions/ai-resolve/index.ts`

KI-gesteuerte Problemlösung über Lovable AI Gateway:
- Nimmt Problem-Typ + Kontext (Sendungen, Touren, Fahrzeuge)
- Nutzt `google/gemini-3-flash-preview` für Analyse und Lösungsvorschlag
- Bei Kapazitätsproblemen: Automatische Neuplanung via `plan-tour`
- Gibt strukturierte Lösung zurück (welche Sendung wohin, neue Touraufteilung)

### 3. `supabase/functions/plan-tour/index.ts` — Erweitern

- Neuer Parameter `exclude_shipment_ids` für partielle Neuplanung
- Parameter `force_replan: true` für Kapazitätsüberschreitungen

### Betroffene Dateien
- `src/pages/dispatch/Probleme.tsx` — Kompletter Neubau (~400 Zeilen)
- `supabase/functions/ai-resolve/index.ts` — Neue Edge Function
- `supabase/functions/plan-tour/index.ts` — Kleine Erweiterung

### Technische Details
- Dialog nutzt shadcn `Sheet` (von rechts einblendend) für großen Inhalt
- Unzugeordnete Sendungen: `shipment` LEFT JOIN `tour_stop` WHERE `tour_stop.id IS NULL`
- Kapazitätsprüfung: SUM(`shipment.weight_kg`) per Tour vs. `vehicle.capacity`
- KI-Aufruf über Lovable AI Gateway mit LOVABLE_API_KEY (bereits konfiguriert)
- Manuelle Tour-Erstellung: Insert in `tour` + `tour_stop` direkt via Supabase SDK

