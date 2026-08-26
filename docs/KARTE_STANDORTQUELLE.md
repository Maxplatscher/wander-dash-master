# Standortquelle der Karte

Stand: 22.08.2026 (nach Samstagsziel, Fahrer-GPS)

## Heute

Die Karte (`src/components/dispatch/LiveMap.tsx`, `DriverDetailDialog.tsx`,
`DriverTourView.tsx`) zeigt, in dieser Reihenfolge:

1. **Fahrer-GPS**, wenn in `driver_position` ein Fix liegt, der höchstens 30 Minuten alt
   und genauer als 250 m ist. Das Alter steht sichtbar auf dem Badge („GPS vor 2 Min").
   Es gibt kein Label „Live-Standort".
2. Sonst den letzten vom Fahrer bestätigten Stop, sonst den nächsten disponierten Stop
   (`shipment.location_x` / `location_y`, Konvention lat/lng, `src/lib/tour-position.ts`).
3. Fehlt beides, wird nichts geschätzt. Die Tour steht unter der Karte bei „Ohne Koordinaten".

Fahrer teilen den Standort bewusst in „Meine Tour" (`Standort teilen`). Die RPC
`report_my_position` schreibt nur die eigene Position; Disposition liest nur die eigene
Company. Fixes älter als 24 Stunden werden beim nächsten Report gelöscht.

## Voraussetzung, damit die Karte überhaupt Marker zeigt

`shipment.location_x` / `location_y` müssen befüllt sein. Dafür gibt es die Edge Function
`geocode-shipments`. Sie versucht zuerst Google (Secret `GOOGLE_MAPS_API_KEY`, eigener
Server-Key ohne HTTP-Referrer). Ist der Key der Browser-Key oder fehlt er, fällt sie auf
Nominatim (OpenStreetMap) zurück — echte Geokodierung, keine Platzhalter. Geschrieben
werden nur Treffer mit belastbarer Genauigkeit, niemals 0/0. Aufruf in der Kontrollzentrale
(„Adressen geokodieren“) und automatisch vor „Planung starten“.

`plan-tour` überspringt Sendungen ohne Koordinaten statt sie nach 0/0 (Golf von Guinea) zu legen.

## Offen vor Verkauf — Google-Server-Key

Kein Blocker für den Samstag, aber nicht vergessen (`docs/CHECKLISTE_VOR_VERKAUF.md`, Punkt 5):

1. In Google Cloud einen **zweiten** Key anlegen (nicht `VITE_GOOGLE_MAPS_API_KEY` kopieren).
2. APIs: Geocoding API und Distance Matrix API.
3. Restriction: keine HTTP-Referrer; optional IP, sonst unrestricted und nur als Edge Secret halten.
4. `npx supabase secrets set GOOGLE_MAPS_API_KEY=<server-key>` (Wert nicht loggen).
5. In der Kontrollzentrale „Adressen geokodieren“ auslösen und prüfen, dass `provider` = `google` ist statt `nominatim`.

## Echtes Live-GPS — umgesetzt 22.08.2026

Quelle: `navigator.geolocation` auf der Fahreransicht, Tabelle `driver_position`, RPC
`report_my_position`. Badge zeigt das Messalter. „Live" nur, wenn man das Alter liest —
das Wort „Live-Standort" bleibt absichtlich aus.

Offen bleiben: Aufbewahrung über 24 Stunden hinaus / Historie, Telematik-Fremdanbieter.
