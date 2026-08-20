# Prompt für Cursor: neuen Design-Prototyp mit Ist-Stand abgleichen

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter).

## Ausgangslage

Max hat einen neuen, interaktiven Design-Prototyp exportiert (`docs/design/DispoCenter-Prototyp-standalone.dc.html`) — deckt alle 6 Sektionen ab (Startseite, Kalender, Kontrollzentrale, Fahrer & Fahrzeuge, Probleme, Einstellungen) inkl. Farbtokens, Abständen und zwei Layout-Varianten für Startseite/Kalender. Das ist die neue, autoritative Design-Referenz — genauer und aktueller als der frühere Figma-Screenshot.

**Wichtig, vor dem Loslegen prüfen:** Der Prototyp wurde offenbar vor mehreren Fixes dieser Woche gebaut — seine Mock-Daten (`DEBTS`-Array, `INTEGRATIONS` mit `credentials_enc`/`upsert_integration`) spiegeln einen älteren, nicht mehr aktuellen Stand. Der echte Code ist an mehreren Stellen bereits weiter als der Prototyp (siehe unten). **Nicht blind nachbauen — nur die unten aufgeführten echten Lücken schließen, alles andere ist bereits erledigt oder besser als im Prototyp.**

## Bereits erledigt / besser als der Prototyp (nicht anfassen)

- Kalender (`Kalender.tsx`): Monat/Woche/Tag mit echten Supabase-Daten, real funktionierendem `plan-tour`/`assign-depot` — entspricht bzw. übertrifft Prototyp-Varianten A/B.
- Kontrollzentrale (`Kontrollzentrale.tsx`): E-Mail-Platzhalter, Lieferschein-Tabelle, Demo-Bereich, plus `ArticleReviewPanel` (KI-Artikel-Recherche) — hat der Prototyp gar nicht.
- Probleme (`Probleme.tsx`): echte KI-Vorschläge über `ai-resolve`, manuelle Zuordnung per Sheet — funktional bereits über dem Prototyp.
- Einstellungen (`Einstellungen.tsx`): „Offene technische Punkte" ist bereits der echte, aktuelle Stand (Vault, GRANT SELECT, assign-depot etc. korrekt als erledigt markiert) — die `DEBTS` im Prototyp sind veraltet, nicht übernehmen.
- Sidebar-Struktur und Such-Placeholder („Suchen…") stimmen bereits mit dem Prototyp überein.

## Auftrag — konkrete Lücken

### 1. Shell-Chrome flach ziehen (größte visuelle Lücke)

`src/pages/DispatchDashboard.tsx` nutzt noch `rounded-[24px]`, `backdropFilter: blur(20px) saturate(140%)` und ein Gradient-Logo-Icon (Sidebar-Header, Topbar, beide `<aside>`/`<header>`-Container). Der Prototyp (und bereits `index.css`, das schon flach ist) verwendet durchgehend `border-radius: 6px`, feste `--panel`/`--hairline`-Farben ohne Blur/Glow. Sidebar- und Header-Container in `DispatchDashboard.tsx` auf dasselbe flache Muster umstellen wie die übrigen Karten (`.glass-card` aus `index.css`, die bereits korrekt ist) — Blur, Gradient-Logo-Box und die 24px-Rundung entfernen.

### 2. Fahrer & Fahrzeuge (`Fahrer.tsx`)

- Header ergänzen um zusammenfassende Zeile analog Prototyp: „{N} Fahrer · {M} Fahrzeuge" (aus den bereits geladenen `cards`/Fahrzeug-Query ableiten).
- „Fahrer hinzufügen"-Button oben rechts im Header (Primary-Button, wie auf der Startseite bereits vorhanden) — kann den bestehenden Add-Driver-Dialog aus `Startseite.tsx` wiederverwenden oder eine eigene Instanz öffnen, nicht duplizieren, wenn sich der Dialog sauber auslagern lässt.
- Klick auf eine Fahrer-Karte öffnet die bestehende Visitenkarte (`DriverDetailDialog`) — aktuell ist das nur von der Startseite (`Fahrer-Fortschritt`-Panel) aus verdrahtet, auf dieser Seite fehlt der `onClick` auf der Card komplett.

### 3. Probleme (`Probleme.tsx`)

Filter-Buttons zeigen aktuell die rohen englischen Keys als Label (`conflict`, `unassigned`, `absent` — Zeile ~34-38, `filterLabels`). Prototyp zeigt deutsche Labels: „Zeitkonflikt", „Ohne Tour", „Abwesend". Nur die `label`-Werte anpassen, `key` bleibt wie er ist.

### 4. Startseite — Wetter-Niederschlag (falls noch offen)

Falls `docs/PROMPT_MITTWOCH_KERNFEATURES.md` noch nicht umgesetzt wurde: `CompactWeather()` in `Startseite.tsx` um `precipitation_probability` (Open-Meteo `hourly`-Parameter) ergänzen und anzeigen — der Prototyp bestätigt das (`{{ weather.rain }} % Niederschlag`).

### 5. Tote Komponente

`src/components/dispatch/WeatherWidget.tsx` ist weiterhin unbenutzt (wird nirgends importiert) — löschen, falls noch nicht geschehen.

## Arbeitsweise

Reihenfolge wie oben, nach jedem Punkt kurz im Browser gegenprüfen (besonders Punkt 1, da CSS-lastig). Bei Unsicherheit zu genauen Pixelwerten die Datei `docs/design/DispoCenter-Prototyp-standalone.dc.html` direkt öffnen — sie enthält die exakten Farbtokens (`--panel: #151517`, `--hairline: #26262b`, `--primary: #7ce8f5` usw.) und Abstände im `<style>`-Block.
