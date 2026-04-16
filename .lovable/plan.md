

# Fahrer-Karten in die KPI-Platzhalter-Felder einfügen

## Übersicht

Die bunten Fahrer-Karten (Gradient-Karten mit Tour-Details) sollen direkt in die 4 KPI-Kästchen oben eingebaut werden — dort wo aktuell die "Fahrer Hinzufügen" Plus-Kreise angezeigt werden. Wenn Demo-Daten vorhanden sind, ersetzen die Fahrer-Karten die Platzhalter. Der separate "Aktive Touren"-Bereich darunter entfällt.

## Technische Umsetzung

### `src/pages/dispatch/OperativeLage.tsx`

1. **KPI-Row umbauen (Zeile 426-491)**: Die 4 Slots im `grid grid-cols-4` werden so geändert:
   - Wenn `driverCards` vorhanden sind, werden die ersten 4 Fahrer-Karten (die bunten Gradient-Karten mit Truck-Icon, Tour-Name, Fahrer-Name, Stops, Gewicht, Fortschrittsbalken) direkt in diese Slots gerendert
   - Leere Slots bleiben als "Fahrer Hinzufügen" Plus-Kreise
   - Die Grid-Cols werden dynamisch angepasst (z.B. bei 3 Fahrern → 3 Fahrer-Karten + 1 Plus-Kreis)

2. **"Aktive Touren"-Sektion entfernen (Zeile 493-541)**: Der separate Block mit Überschrift "Aktive Touren", "Alle anzeigen →" und den Fahrer-Karten im `grid grid-cols-3` wird komplett entfernt, da die Karten jetzt oben in der KPI-Row leben.

3. **Fahrer Fortschritt + Live Karte bleiben** wie sie sind im `grid grid-cols-2` darunter.

