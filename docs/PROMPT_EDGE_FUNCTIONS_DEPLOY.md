# Prompt für Cursor: Alle Edge Functions deployen

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter), Supabase-Projekt `sxqbmxqnwtrgibfryvqf` (Region eu-central-1, `supabase/config.toml` zeigt bereits korrekt darauf).

## Ausgangslage

Geprüft über die Supabase-Verwaltung: **Im Projekt ist aktuell keine einzige Edge Function deployed.** Lokal existieren acht Functions unter `supabase/functions/`, die aber noch nie auf den Server hochgeladen wurden. Dadurch funktionieren aktuell weder Tourenplanung noch Lieferschein-KI noch Integrationen noch die neue Artikel-Recherche — unabhängig vom Frontend-Stand.

## Auftrag

Alle acht Functions deployen:

```bash
supabase link --project-ref sxqbmxqnwtrgibfryvqf
supabase functions deploy assign-depot
supabase functions deploy plan-tour
supabase functions deploy ai-resolve
supabase functions deploy upsert-integration
supabase functions deploy test-integration
supabase functions deploy create-admin
supabase functions deploy demo-setup
supabase functions deploy research-article
```

Falls `supabase link` nach einem Access Token fragt: über `supabase login` vorher einloggen (interaktiv im Terminal, kein API-Key im Code hinterlegen).

## Secrets prüfen — sonst deployt die Function, wirft aber zur Laufzeit Fehler

**Update:** `GOOGLE_MAPS_API_KEY` und `GEMINI_API_KEY` sind bereits im Supabase-Dashboard gesetzt (18.08.2026, verifiziert unter Edge Functions → Secrets). Nicht nochmal setzen, nur mit `supabase secrets list` gegenprüfen, dass Cursor dieselben Namen sieht.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` sind bei Supabase automatisch für jede Function verfügbar, dafür ist nichts zu tun. Zusätzlich manuell nötig:

- **`GOOGLE_MAPS_API_KEY`** (für `assign-depot`, Distanzberechnung) — denselben Wert verwenden, der schon in `.env` unter `VITE_GOOGLE_MAPS_API_KEY` steht:
  ```bash
  supabase secrets set GOOGLE_MAPS_API_KEY=<Wert aus .env übernehmen>
  ```
- **`GEMINI_API_KEY`** (für `ai-resolve` und `research-article`, direkter Call an `generativelanguage.googleapis.com`) — Key aus Google AI Studio:
  ```bash
  supabase secrets set GEMINI_API_KEY=<Wert> --project-ref sxqbmxqnwtrgibfryvqf
  ```
- **`SERPER_API_KEY`** bzw. **`TAVILY_API_KEY`** (für `research-article`) — ohne diese versucht die Function Google-Search-Grounding über den vorhandenen `GEMINI_API_KEY`. Ist dafür kein Suchkontingent verfügbar (HTTP 429), muss einer der externen Provider gesetzt werden; quelllose KI-Schätzungen werden bewusst nicht gespeichert.

Alle gesetzten Secrets prüfen mit:
```bash
supabase secrets list
```
(zeigt nur Namen, keine Werte — reicht zum Verifizieren, dass nichts fehlt.)

## Nach dem Deploy — kurzer Funktionstest pro Function

Nicht nur "deployed ohne Fehler" prüfen, sondern jede Function einmal real auslösen und Logs checken (`supabase functions logs <name>` oder im Dashboard):

- `assign-depot` — über die App eine Sendung anlegen/Depot zuordnen lassen
- `plan-tour` — Tourenplanung für ein Testdatum anstoßen
- `ai-resolve` — auf der Probleme-Seite eine offene Kapazitätswarnung lösen lassen
- `upsert-integration` / `test-integration` — in den Einstellungen eine Integration anlegen und testen (auch der neue Typ `research_source`)
- `create-admin` / `demo-setup` — nur bei Bedarf, nicht kritisch für den Live-Betrieb
- `research-article` — einen Lieferschein mit unbekanntem Artikel durchlaufen lassen, Vorschlag im `ArticleReviewPanel` prüfen

## Wichtig

`verify_jwt`-Einstellung pro Function beim Deploy nicht blind übernehmen — falls eine Function (z. B. `plan-tour`, die von `ai-resolve` intern mit Service-Role-Bearer aufgerufen wird) unerwartet 401 zurückgibt, das gezielt für diese Function prüfen statt pauschal JWT-Verifizierung für alle abzuschalten.
