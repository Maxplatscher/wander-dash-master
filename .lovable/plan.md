

# Die 3 KPI-Kästchen rechts ebenfalls als "Hinzufügen"-Kreise gestalten

## Was sich ändert

Die drei KPI-Karten rechts neben dem Fahrer-Kreis (Stops erledigt, Gesamtgewicht, Offene Probleme) zeigen aktuell immer ihre Werte — auch wenn sie 0 sind. Sie sollen die gleiche Logik bekommen wie die Fahrer-Karte:

- **Stops erledigt = 0/0** → Kreis mit `+` und Label "Tour Hinzufügen", klick öffnet den gleichen Flow oder navigiert zur Kalender/Touren-Seite
- **Gesamtgewicht = 0 kg** → Kreis mit `+` und Label "Sendung Hinzufügen", klick navigiert zur Sendungs-Verwaltung oder öffnet einen Dialog
- **Offene Probleme = 0** → Kreis mit `+` und Label "Problem Melden", klick öffnet einen Dialog zur Problem-Erfassung

## Technische Umsetzung

### Datei: `src/pages/dispatch/OperativeLage.tsx`

1. **Stops-Karte** (Zeile 408-414): Wenn `completedStops === 0 && totalStops === 0`, den gleichen Kreis-Style wie bei Fahrern rendern. Klick navigiert zu `/dispatch/kalender` (Tourenplanung).

2. **Gewicht-Karte** (Zeile 415-421): Wenn `totalWeight === 0`, Kreis-Style mit "Sendung Hinzufügen". Klick navigiert zu `/dispatch/kontrollzentrale` (Sendungsverwaltung).

3. **Probleme-Karte** (Zeile 422-428): Wenn `activeProblems.length === 0`, Kreis-Style mit "Problem Melden". Klick navigiert zu `/dispatch/probleme`.

Jeder Kreis bekommt das identische Design: `w-20 h-20 rounded-full border-2 border-dashed` mit passender Farbe (emerald/amber/red), Plus-Icon, und Label darunter.

