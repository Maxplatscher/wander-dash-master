

# Dashboard lebhafter und uebersichtlicher gestalten

## Aktuelle Situation
Das Dashboard zeigt KPI-Karten, eine Tageszusammenfassung und Quick-Links -- alles funktional, aber visuell flach und eintoenig. Alle Karten sehen gleich aus, es gibt keine Farb-Akzente, keine visuellen Hierarchien und viel leerer Raum unten.

## Aenderungen

### 1. KPI-Karten aufwerten
- Farbige linke Raender oder Hintergrund-Gradienten je nach Variant (gruen fuer Erfolg, orange fuer Warnung, rot fuer Konflikte)
- Groessere, fettere Zahlen mit animiertem Zaehler-Effekt beim Laden
- Subtile Hover-Animation (leichtes Anheben/Schatten)
- Pulsierender Punkt bei "Aktive Touren" wenn Touren laufen

### 2. Tageszusammenfassung als Hero-Bereich
- Gradient-Hintergrund (Primary-Farbe) statt flacher Karte
- Weisse Schrift auf farbigem Hintergrund
- Groessere, prominentere Buttons
- Status-Indikator (gruener Punkt "System aktiv" oder "Keine Daten")

### 3. Quick-Links als Feature-Cards
- Icons groesser und farbig in einem Kreis-Hintergrund
- Pfeil-Icon rechts als Hover-Indikator
- Dezente Hover-Animation (Border-Farbe, leichter Schatten)

### 4. Neuer Abschnitt: Aktivitaets-Timeline
- Kleine "Letzte Aktivitaeten" Liste unter den Quick-Links
- Zeigt letzte Planungen, Demo-Setups etc. (vorerst statisch/Platzhalter)
- Gibt dem Dashboard Leben und fuellt den leeren Raum

### 5. Willkommens-Header
- "Guten Morgen/Tag/Abend" Begruessung mit aktuellem Datum
- Kurze Statuszeile ("Alles im gruenen Bereich" oder "3 offene Probleme")

## Betroffene Dateien
- `src/components/dispatch/KpiCard.tsx` -- Redesign mit Farben, Animation
- `src/pages/dispatch/Tagesleitstelle.tsx` -- Layout-Umstrukturierung, Willkommens-Header, Timeline
- `src/index.css` -- Ggf. kleine Utility-Klassen fuer Animationen

