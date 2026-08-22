# Standortquelle der Karte

Stand: 22.08.2026 (Block 2 Tagesplan Samstag)

## Heute

Es gibt **keine GPS-Ortung**. Die Karte (`src/components/dispatch/LiveMap.tsx`,
`DriverDetailDialog.tsx`, `DriverTourView.tsx`) zeigt ausschließlich die Lage von Stops:

- Marker = letzter vom Fahrer bestätigter Stop (`tour_stop.driver_completed` /
  `driver_completed_at`), sonst der nächste disponierte Stop.
- Koordinaten kommen einzig aus `shipment.location_x` / `shipment.location_y`.
  Projektkonvention: `location_x` = Breitengrad, `location_y` = Längengrad (so auch in den
  Edge Functions `assign-depot` und `demo-setup`). Zentral geprüft in
  `src/lib/tour-position.ts`.
- Fehlt eine Koordinate, wird nichts geschätzt. Die Tour erscheint in der Liste
  „Ohne Koordinaten" unter der Karte.

Deshalb ist die Karte als „Tourposition / letzter bestätigter Stop" beschriftet und trägt den
Hinweis „Keine GPS-Ortung". Kein Element darf als Live-Standort gelesen werden.

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

## Echtes Live-GPS später

Quelle: Standortfreigabe im Browser des Fahrers auf der Fahreransicht
(`navigator.geolocation`, Einwilligung liegt bereits vor: `src/lib/consent.ts`,
`ConsentDialog`/`StepPermissions`). Kein Fremdanbieter, keine Telematikbox nötig.

Dafür fehlt eine eigene Tabelle, z. B. `driver_position`:

| Feld | Zweck |
| --- | --- |
| `driver_id` | FK auf `driver.id` |
| `company_id` | Mandantentrennung, Pflicht für RLS |
| `lat`, `lng` | Position |
| `accuracy_m` | Genauigkeit, um unbrauchbare Fixes zu verwerfen |
| `recorded_at` | Zeitpunkt der Messung (Basis für „Stand vor x Minuten") |
| `tour_id` | optionaler Bezug zur laufenden Tour |

Regeln, bevor daraus ein „Live"-Label werden darf: RLS (Fahrer schreibt nur eigene Position,
Disposition liest nur die eigene Company), Aufbewahrungsfrist/Löschung, Anzeige des
Messzeitpunkts und ein sichtbares Alter (veraltete Fixes nicht als aktuell darstellen).
