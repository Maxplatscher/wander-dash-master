# Prompt für Cursor: Kernfeatures fertigstellen (Mittwoch)

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter), Supabase-Projekt `sxqbmxqnwtrgibfryvqf`.

## Ausgangslage (bereits geprüft, nicht blind neu machen)

Startseite-Redesign und Sidebar-Merge sind größtenteils schon umgesetzt (`src/pages/dispatch/Startseite.tsx`, `src/lib/navigation.ts`, `src/pages/DispatchDashboard.tsx`): Begrüßungskarte, einheitliche 6er-KPI-Reihe, „Fahrer-Fortschritt"-Panel und eine Stundenvorschau im Wetter-Block existieren bereits. Sidebar ist bereits auf 6 Einträge zusammengeführt („Tagesleitstelle"/„Operative Lage" → „Startseite"). Bitte nicht von vorne bauen, sondern gezielt die unten aufgeführten Lücken schließen.

## Auftrag

### 1. Artikel-KI-Recherche end-to-end testen (kein Code, reiner Test)

1. In den Einstellungen (`Einstellungen` → Integrationen) eine Integration vom Typ **„Branchen-Website (Recherchequelle)"** (`research_source`) anlegen — Feld `base_url` mit einer echten Branchen-Website des Testunternehmens befüllen.
2. In `Kontrollzentrale` (Sektion „Lieferscheine") einen Lieferschein mit einer unbekannten Artikelposition öffnen. Dort erscheint automatisch das Panel **„Artikel-Review (KI-Recherche)"** (`ArticleReviewPanel.tsx`), sofern `shipment.positionen` unbekannte Artikel enthält.
3. Über den Button „Positionen prüfen" den `research-article`-Edge-Function-Call auslösen (Action `scan_shipment`), danach pro gefundenem Artikel „Recherchieren" klicken (Action `research`).
4. Vorschlag (Maße/Gewicht/Quelle/Confidence) prüfen: plausibel? Quelle verlinkt korrekt?
5. Einmal „Übernehmen" testen (schreibt in `public.artikel`, setzt `missing_fields.unknown_articles[].status = confirmed`) und einmal „Manuell korrigieren" + „Speichern & übernehmen" testen.
6. Logs bei Bedarf mit `supabase functions logs research-article` prüfen, falls ein Aufruf fehlschlägt (z. B. fehlender `GEMINI_API_KEY`/`SERPER_API_KEY`/`TAVILY_API_KEY` — Keys sind laut Deploy-Check bereits gesetzt, nur zur Sicherheit).
7. Kurze Rückmeldung: hat die Recherche brauchbare Werte geliefert, oder muss der Prompt/die Provider-Strategie in `supabase/functions/research-article/index.ts` nachjustiert werden?

### 2. Startseite — verbleibende Lücken zum Figma-Design

Nur diese konkreten Punkte, nicht das ganze Layout neu bauen:

- **Niederschlag fehlt im Wetter-Block.** `CompactWeather()` in `Startseite.tsx` holt bereits `hourly.temperature_2m` und `weathercode` von Open-Meteo — zusätzlich `precipitation_probability` in den `hourly`-Query-Parameter aufnehmen und pro Stunden-Kachel als kleiner Prozentwert (z. B. „☔ 20 %") anzeigen.
- **Tote Komponente entfernen:** `src/components/dispatch/WeatherWidget.tsx` wird nirgends mehr importiert (Startseite nutzt die eigene inline `CompactWeather`) — Datei löschen oder klar als unused markieren, damit kein doppelter Wetter-Code gepflegt wird.
- **Pixelgenauer Feinabgleich gegen die Figma-Referenz** (Abstände, Kartenfarben, Schriftgrößen) — dafür bitte kurz Rücksprache/Screenshot, falls das aktuelle Figma noch vorliegt, sonst nach bestem Ermessen an den bestehenden Glass-Design-Tokens ausrichten.

### 3. Sidebar/Topbar — letzter Schliff

- Sidebar-Struktur (6 Einträge, Merge) ist fertig — keine Änderung nötig.
- Such-Placeholder in der Topbar (`DispatchDashboard.tsx`, Zeile mit `placeholder="Suchen…"`) auf **„Sendung, Fahrer, Adresse suchen..."** ändern, passend zum Figma-Referenzdesign.
- Optional: prüfen ob eine echte Suchfunktion dahinter sinnvoll ist oder das Feld aktuell nur Platzhalter ist (aktuell rein visuell, kein `onChange`/Query dahinter) — falls Zeit reicht, in einem eigenen kleinen Schritt anbinden, sonst für später vormerken.

## Arbeitsweise

Nach jedem der drei Blöcke kurz testen und kompakt zurückmelden (was geprüft/geändert wurde, was noch offen ist) — nicht alles auf einmal committen.
