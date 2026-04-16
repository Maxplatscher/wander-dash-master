

# Google Maps neben Fahrer Fortschritt einbauen

## Übersicht

Rechts neben dem "Fahrer Fortschritt"-Kästchen wird eine Google Maps Live-Karte eingeblendet. Der JavaScript-API-Key (`AIzaSyD45ivdJQ9LwYJBctnXPoi8NHGWK2IMhLg`) ist bereits in `LiveMap.tsx` hinterlegt — er ist der richtige für die Karteneinbettung.

## Technische Umsetzung

### `src/pages/dispatch/OperativeLage.tsx`

1. **Import**: `LiveMap` aus `@/components/dispatch/LiveMap` importieren.
2. **Layout** (Zeile 540): Das `col-span-3 max-w-[50%]` Div wird zu `col-span-3` geändert und enthält ein inneres `grid grid-cols-2 gap-4`:
   - **Links**: Bestehendes "Fahrer Fortschritt"-Kästchen (bleibt unverändert)
   - **Rechts**: Neues Kästchen im gleichen `CARD`-Style mit Titel "Live Karte" und `<LiveMap />` Komponente

### `src/components/dispatch/LiveMap.tsx`

Keine Änderungen nötig — der JS-Key ist bereits korrekt eingebaut.

