

# Tagesleitstelle Redesign: Erweiterte Zusammenfassung + Wetter-Widget

## Überblick

Die Startseite wird umgebaut:
- **Entfernen**: Quick Links (Offene Probleme, Planversionen, Fahrer & Fahrzeuge) und "Letzte Aktivitäten" Timeline
- **Tageszusammenfassung erweitern**: Fahrer-Übersicht pro Fahrer (gefahrene/aktive/offene Touren), Personalausfälle-Hinweis, Verkehrshinweise (auto-refresh alle 2 Min)
- **Wetter-Widget unten**: Zeigt aktuelles Wetter am Standort mit animiertem Hintergrund, Standort per Klick änderbar

## Änderungen

### 1. `src/pages/dispatch/Tagesleitstelle.tsx` — Großer Umbau

**Entfernen:**
- `quickLinks` Array + Quick Links Grid (Zeilen 135-222)
- `activityItems` Array + Activity Timeline (Zeilen 64-68, 224-240)

**Tageszusammenfassung erweitern (Hero-Block):**
- Neuen `useDriverSummary(date)` Hook: Lädt alle Fahrer + deren zugewiesene Touren (über `tour_stop` → `tour`), berechnet pro Fahrer: gefahrene Touren (completed stops), aktive Touren, offene Touren
- Fahrer-Liste innerhalb der Zusammenfassung: Jeder Fahrer als kompakte Zeile mit Name, 3 Mini-Badges (gefahren/aktiv/offen)
- Personalausfälle-Hinweis: Wenn `absentDrivers > 0`, gelber Alert-Banner mit Anzahl abwesender Fahrer
- Verkehrshinweise: Statischer Platzhalter-Bereich (simulierte Verkehrsmeldungen), `useEffect` mit `setInterval` alle 120s für Refresh-Animation/Timestamp

**Wetter-Widget (neuer Bereich unten):**
- Neue Komponente `WeatherWidget` inline oder als separate Datei
- Nutzt kostenlose Open-Meteo API (`https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current_weather=true`) — kein API-Key nötig
- Standort: Default München (48.14, 11.58), gespeichert in `useState`
- Klick auf Standort-Name öffnet kleines Popover mit Eingabefeld für Stadt + Geocoding via Open-Meteo
- Animierter Hintergrund: CSS-Gradient/Animation basierend auf Wetter-Code (Sonne = warm gradient, Regen = blau/grau, Schnee = weiß/hellblau, Wolken = grau)
- Zeigt: Temperatur, Windgeschwindigkeit, Wetterbeschreibung, Wetter-Icon (Lucide: Sun, Cloud, CloudRain, Snowflake etc.)
- Auto-Refresh alle 10 Minuten

### 2. `src/components/dispatch/WeatherWidget.tsx` — Neue Komponente

- Props: keine (self-contained mit eigenem State)
- Open-Meteo fetch mit `useQuery`
- Standort-Popover mit `Popover` + Input
- Wetter-Code → Icon + Animation Mapping
- Hintergrund-Animation via Tailwind classes + inline gradient

### Betroffene Dateien
- `src/pages/dispatch/Tagesleitstelle.tsx` — Umbau
- `src/components/dispatch/WeatherWidget.tsx` — Neu
- Keine DB-Änderungen nötig

### Technische Details
- Open-Meteo API ist kostenlos, kein Key nötig, CORS-frei
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=Berlin`
- WMO Weather Codes → Lucide Icons Mapping (0-1: Sun, 2-3: Cloud, 45-48: CloudFog, 51-67: CloudRain, 71-77: Snowflake, 80-82: CloudRain, 95-99: CloudLightning)
- Verkehrshinweise sind simuliert (statische Beispieldaten mit Timestamp), da echte Traffic-APIs einen Key benötigen

