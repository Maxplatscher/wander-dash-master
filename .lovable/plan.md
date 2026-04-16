

# Demo-Daten in Fahrer Fortschritt & Live Karte einfügen

## Problem

Die "Fahrer Fortschritt"-Karte und "Live Karte" werden nur im Leer-Zustand angezeigt (Zeile 539-569, else-Branch). Sobald Demo-Daten existieren und `driverCards` gefüllt ist, werden stattdessen die bunten Fahrer-Karten gerendert — die Fortschritts-Balken und die Karte verschwinden.

## Lösung

Die "Fahrer Fortschritt"-Karte und "Live Karte" werden **immer** angezeigt — unabhängig davon, ob Fahrer-Daten vorhanden sind. Wenn Demo-Daten geladen werden, zeigt der Fortschritts-Chart die echten Fahrer-Namen und deren Prozentwerte an.

## Technische Umsetzung

### `src/pages/dispatch/OperativeLage.tsx`

1. **Layout umbauen** (Zeile 504-571): Die Fahrer-Karten (`driverCards`) bleiben im `grid grid-cols-3` — aber darunter (nicht als else-Branch) kommt immer ein `grid grid-cols-2 gap-4` mit:
   - **Links**: "Fahrer Fortschritt" — wenn `driverCards` vorhanden, zeigt es die echten Namen + Prozent (`completedStops / totalStops * 100`). Sonst Platzhalter wie bisher.
   - **Rechts**: "Live Karte" mit `<LiveMap />` — immer sichtbar.

2. **Konkreter Umbau**: Der ternäre Operator `driverCards.length > 0 ? ... : ...` wird aufgeteilt:
   - Zuerst die Fahrer-Karten (nur wenn vorhanden)
   - Dann **immer** die Fortschritts- und Karten-Zeile darunter

