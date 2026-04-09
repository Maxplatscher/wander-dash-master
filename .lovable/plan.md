

# Google Maps Integration — Operative Lage

## API Key
Der **JavaScript-Schlüssel** (`AIzaSyD45ivdJQ9LwYJBctnXPoi8NHGWK2IMhLg`) wird verwendet — dieser ist ein öffentlicher (publishable) Key und kann direkt im Code gespeichert werden.

## Änderungen

### 1. Dependency installieren
- `@react-google-maps/api`

### 2. Neue Komponente: `src/components/dispatch/LiveMap.tsx`
- Google Map mit `@react-google-maps/api` (`GoogleMap`, `Marker`, `InfoWindow`)
- Zentrum: Deutschland (~51.16°N, 10.45°E), Zoom 7
- Fahrzeug-Marker für jeden aktiven Fahrer (Max M., Lisa K., Tom B., Sarah W.) mit Demo-Koordinaten
- Klick auf Marker → InfoWindow mit Name, Tour-ID, Status
- Helles Karten-Styling passend zum Teal-Design

### 3. Update: `src/pages/dispatch/OperativeLage.tsx`
- Map-Platzhalter (MapPin-Icon + "Kartenansicht") ersetzen durch `<LiveMap />`
- Gleiche Card-Struktur beibehalten (border, rounded-lg, overflow-hidden)

### Kein `.env` nötig
Der JS-Key wird als Konstante direkt in `LiveMap.tsx` gespeichert — er ist ein öffentlicher Browser-Key.

