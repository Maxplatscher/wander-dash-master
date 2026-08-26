# Prompt für Cursor: Dienstag — Hosting fertig + Keys

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter), Supabase-Projekt `sxqbmxqnwtrgibfryvqf` (Region eu-central-1), Cloudflare-Pages-Projekt `dispocenter` (`wrangler.toml`).

## Ausgangslage (heute geprüft)

- Alle zehn Edge Functions sind deployed und `ACTIVE` (inkl. `fetch-imap`, `geocode-shipments`) — Montags-Punkt ist erledigt, hier nichts mehr tun.
- Cloudflare-Organisation „DispoCenter": Domain-Transfer für `dispocenter.com` steht jetzt auf **„Ready for transfer"**, ist aber noch **nicht gestartet** (Schritt 1 von 3, „Select domains to transfer"). Das heißt: **DNS/Referrer heute noch NICHT auf `https://dispocenter.com/*` umstellen** — das ist erst dran, sobald der Transfer tatsächlich abgeschlossen ist (Status wechselt zu „Transfers in progress" → abgeschlossen). Bis dahin läuft alles über die `*.pages.dev`-Subdomain.
- Supabase-Organisation läuft aktuell auf **Plan „Free"** — das ist der Pause-Risiko-Punkt aus dem Wochenplan: Free-Projekte pausieren nach Inaktivität automatisch. Vor dem Kundentermin klären, ob auf einen bezahlten Plan (Pro) gewechselt wird, damit das Projekt nicht während der Testphase einschläft.
- Aus dem Montags-Deploy bekannt: `GOOGLE_MAPS_API_KEY` (Edge Secret) war zuletzt der Browser-Key mit HTTP-Referrer-Restriction — damit liefert Google serverseitig `REQUEST_DENIED` und `geocode-shipments` fällt still auf Nominatim (OSM) zurück. Das ist heute explizit zu verifizieren, nicht anzunehmen.

## Auftrag

### 1. Env-Variablen im Hosting-Projekt (Cloudflare Pages `dispocenter`) setzen

Im Cloudflare-Dashboard unter Pages-Projekt `dispocenter` → Settings → Environment variables (Production, und separat Preview falls genutzt):

- `VITE_SUPABASE_URL` = `https://sxqbmxqnwtrgibfryvqf.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = aktueller Publishable/Anon-Key aus Supabase Dashboard → Settings → API (nicht neu generieren, nur den bestehenden Wert übernehmen)
- `VITE_GOOGLE_MAPS_API_KEY` = der bestehende Frontend-Key aus Google Cloud Console → dort den HTTP-Referrer um die aktuelle Pages-Domain ergänzen (`https://dispocenter.pages.dev/*` bzw. den tatsächlichen Preview-/Production-Hostnamen), **nicht** den Referrer auf `dispocenter.com` setzen, solange der Transfer nicht durch ist

Danach einen neuen Deploy auslösen (Push auf den verbundenen Branch oder manueller Redeploy im Dashboard), damit die Variablen greifen — Vite bakt sie zur Build-Zeit ein.

### 2. Eigenen Google-Server-Key als Supabase Edge Secret anlegen

In Google Cloud Console einen **zweiten, separaten** Key anlegen (nicht den Vite-Key wiederverwenden):

- Application restriction: **keine** HTTP-Referrer-Beschränkung (IP-Restriction optional, sonst „None")
- APIs aktivieren: **Geocoding API** und **Distance Matrix API**

Dann setzen:

```bash
supabase secrets set GOOGLE_MAPS_API_KEY=<neuer-server-key> --project-ref sxqbmxqnwtrgibfryvqf
```

Prüfen, dass der Name existiert (Werte werden nicht angezeigt):

```bash
supabase secrets list --project-ref sxqbmxqnwtrgibfryvqf
```

Den alten, geleakten/referrer-beschränkten Wert danach in der Google Cloud Console löschen, falls er nur für diesen Zweck angelegt war.

### 3. Geokodierung testen — Provider verifizieren

In der App unter „Adressen geokodieren" (bzw. dem Trigger für `geocode-shipments`) eine Testsendung mit vollständiger Adresse anstoßen. Danach nicht nur „hat funktioniert" abhaken, sondern im Ergebnis / in der DB (`shipments`-Tabelle oder Response der Function) explizit prüfen, dass `provider = 'google'` gesetzt ist — nicht `nominatim`. Falls weiterhin Nominatim greift: `supabase functions logs geocode-shipments --project-ref sxqbmxqnwtrgibfryvqf` prüfen, ob der Server-Key überhaupt ankommt bzw. ob Google einen Fehler zurückgibt (Quota, falsche API aktiviert, Billing nicht verknüpft).

### 4. Supabase-Plan-Entscheidung

Bestätigt: Organisation „DispoCenter" ist auf **Free**. Vor dem Kundentermin entscheiden (keine reine Cursor-Aufgabe, aber hier dokumentieren): Upgrade auf Pro, um automatisches Pausieren bei Inaktivität zu verhindern. Falls Upgrade beschlossen wird, im Supabase-Dashboard unter Organization → Billing durchführen — nicht Teil des Codes.

### 5. Domain-DNS — heute noch NICHT anfassen

Nur zur Doku: Sobald „Transfers in progress" den Transfer als abgeschlossen zeigt, dann (und erst dann) DNS in Cloudflare auf das Pages-Projekt zeigen lassen und den Google-Maps-Referrer von `*.pages.dev` auf `https://dispocenter.com/*` umstellen. Heute nicht starten, da Schritt 1 von 3 im Transfer-Flow noch offen ist.

## Abnahme

- App unter HTTPS erreichbar (Pages-Subdomain reicht vorerst) — Env-Variablen sind gesetzt, ein Deploy mit den neuen Werten ist durch.
- Geokodierung läuft nachweislich über `provider = 'google'`, nicht über den Nominatim-Fallback.
- Supabase-Plan-Frage ist entschieden und ggf. umgesetzt (kein Free-Tier-Pause-Risiko mehr vor dem Kundentermin).

## Arbeitsweise

Wie bisher: nach jedem Block kurz testen und Rückmeldung geben, nicht alles gleichzeitig anfassen. Punkt 5 bewusst zurückstellen, bis der Domain-Transfer wirklich abgeschlossen ist.
