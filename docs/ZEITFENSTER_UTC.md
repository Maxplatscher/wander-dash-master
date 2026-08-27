# Zeitfenster und UTC

Stand: 27.08.2026

## Speicherung

`shipment.window_start` und `shipment.window_end` sind `timestamptz` (UTC in Postgres). Gleiches gilt für `tour_stop.arrival_time` / `departure_time`.

Datumsspalten ohne Uhrzeit (`shipment.service_date`, `tour.date`) sind `date` und meinen den **Kalendertag in der Disposition**, nicht eine UTC-Mitternacht als lokale Uhrzeit.

## Anzeige

Die UI formatiert Zeitfenster über `src/lib/format-time.ts`:

- ISO-Zeitstempel → lokale Browser-Zeit (`de-DE`, Stunde:Minute).
- Reine Uhrzeit (`08:00`) bleibt Uhrzeit.
- Ein reines Datum (`2026-08-27`) oder ein unparsebarer Wert wird als `—` gezeigt, nie als `2026-`.

Schichtzeiten der Fahrer (`shift_start` / `shift_end`) sind Zeit-ohne-Zeitzone und werden als `HH:MM` gekürzt.

## Planung

`plan-tour` vergleicht die gespeicherten Zeitstempel 1:1. Es gibt keine separate Firmen-Zeitzone-Spalte. Für den deutschen Piloten gilt: Zeitfenster als echte Zeitstempel anlegen (IMAP/CSV/manuell), nicht als Datumsstring.

## Tests / E2E

Playwright und Integrationstests laufen in der Umgebung des Runners. `toISOString().split('T')[0]` für den gewählten Dispositionstag kann nahe Mitternacht UTC vom lokalen Kalendertag abweichen — deshalb nutzen Kalender/Fahrer-Views wo nötig lokale `getFullYear/getMonth/getDate`.
