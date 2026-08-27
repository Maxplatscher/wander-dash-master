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

`shipment.location_x` / `location_y` müssen befüllt sein. `geocode-shipments` läuft vor
`plan-tour` in Kontrollzentrale und Kalender: Google Geocoding wenn
`GOOGLE_MAPS_API_KEY` gesetzt ist, sonst Nominatim (siehe `docs/NOMINATIM_LIMITS.md`).
Ohne Adresse oder ohne Treffer bleibt die Sendung ungeokodiert — nichts wird geschätzt.

## Echtes Live-GPS später

Quelle: Standortfreigabe im Browser des Fahrers auf **Meine Tour**
(`navigator.geolocation`, `src/lib/consent.ts` → `DRIVER_GPS_STORAGE_KEY`).
Dispatcher-Consent (Zeit/Standort/Lieferschein) liegt im Onboarding und unter Einstellungen.
Kein Fremdanbieter, keine Telematikbox. Es wird **noch keine Position gespeichert**.

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
