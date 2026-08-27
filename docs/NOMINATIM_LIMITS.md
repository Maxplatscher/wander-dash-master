# Nominatim-Nutzung und Limits

Stand: 27.08.2026

`geocode-shipments` geokodiert Lieferadressen ohne Koordinaten (`location_x`/`location_y` leer oder 0/0).

## Reihenfolge

1. **Google Geocoding API**, wenn das Edge-Secret `GOOGLE_MAPS_API_KEY` gesetzt ist.
2. Sonst (oder wenn Google nichts liefert) **Nominatim** (`https://nominatim.openstreetmap.org/search`).

`location_x` = Breite, `location_y` = Länge (siehe `docs/KARTE_STANDORTQUELLE.md`).

## Nominatim-Regeln, die der Code einhält

- User-Agent: `DispoCenter-geocode-shipments/1.0` (Pflicht, sonst 403).
- Pause **1100 ms** zwischen Nominatim-Aufrufen (Nutzungsbedingung: max. ~1 Request/Sekunde).
- HTTP **429** bricht den Lauf ab; der Client zeigt eine Warnung und plant trotzdem mit den bereits vorhandenen Koordinaten.

## Was nicht passiert

- Keine erfundenen Koordinaten. Fehlt die Adresse oder die Suche liefert nichts, bleibt die Sendung ungeokodiert.
- Kein Dauer-Cron auf Nominatim. Der Lauf hängt an „Planung starten“ (Kontrollzentrale und Kalender) bzw. einem direkten Function-Call.
- Die OSM-Nutzungsbedingungen für **Kacheln** gelten hier nicht — wir rufen nur die Search-API auf.

## Betrieb

Bei vielen Sendungen ohne Google-Key ist Nominatim der Engpass. Für den Piloten Google-Geocoding bevorzugen. Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
