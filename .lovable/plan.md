## Ziel

Die Seite **Tagesleitstelle** komplett neu aufbauen im Dashboard-Layout des hochgeladenen Pinterest-Screenshots (dunkles Glassmorphism, 2x2-Grid-Struktur). Bestehende Datenlogik bleibt erhalten, nur Layout & Optik werden ersetzt.

## Neues Layout (Grid 2x2, wie Vorlage)

```text
┌─────────────────────┬───────────────────────────────────────────┐
│                     │  Today's Highlight                        │
│  WETTER             │  ┌─────────┬─────────┬─────────┐          │
│  (groß, links)      │  │ Aktive  │ Fahrz.  │ Fahrer  │          │
│                     │  │ Touren  │ Einsatz │ Einsatz │          │
│  - Temp + Icon      │  ├─────────┼─────────┼─────────┤          │
│  - Stadt            │  │ Unzu-   │ Probl.  │ Abwes.  │          │
│  - Datum/Zeit       │  │ gewies. │         │ Fahrer  │          │
│                     │  └─────────┴─────────┴─────────┘          │
├─────────────────────┼───────────────────────────────────────────┤
│  KALENDER           │  GOOGLE MAPS LIVE                         │
│  Auftrags-Übersicht │  Fahrer-Standorte                         │
│  Tabs: 1 Tag |      │                                           │
│  7 Tage | Monat |   │                                           │
│  Jahr               │                                           │
└─────────────────────┴───────────────────────────────────────────┘
```

## Konkrete Änderungen

### 1. `src/pages/dispatch/Tagesleitstelle.tsx` — komplett neu strukturieren
- Gesamtes 2x2 Grid (`grid grid-cols-2 grid-rows-2 gap-6`) im Glassmorphism-Stil
- Bestehende Hooks `useKpis` & `useDriverSummary` weiterverwenden
- Welcome-Header, Verkehrshinweise, Tageszusammenfassung, alter KPI-Strip → entfernt (neuer Look)

### 2. Oben links — **Wetter-Kachel** (`WeatherWidget`)
- Bleibt funktional gleich (Open-Meteo API, Stadt-Suche)
- Styling angepasst: dunkles Glass-Panel statt heller Gradient
- Größe füllt Quadrant aus

### 3. Oben rechts — **Today's Highlight** (KPI-Block)
- Überschrift "Today's Highlight"
- 3 große KPI-Kacheln in einer Reihe: Aktive Touren, Fahrzeuge im Einsatz, Fahrer im Einsatz
- 3 kleinere KPI-Kacheln darunter: Unzugewiesen, Probleme, Fahrer in Abwesenheit
- KpiCard-Komponente wiederverwenden, klickbar (öffnet KpiDetailDialog)
- Neue KPI-Werte:
  - Probleme = `unassigned + conflicts`
  - Abwesende Fahrer = `kpis.absentDrivers`

### 4. Unten links — **Auftrags-Kalender** (neue Komponente `OrdersCalendar`)
- Datei: `src/components/dispatch/OrdersCalendar.tsx`
- Tabs/Toggle: **1 Tag · 7 Tage · Monat · Jahr**
- Lädt `shipment` für gewählten Zeitraum (gruppiert nach `service_date`)
- Tag-View: Liste der Aufträge des Tages
- 7-Tage-View: Horizontale Kalender-Streifen mit Anzahl pro Tag
- Monat: Kompakter Monatskalender mit Auftrags-Counts pro Tag (Heatmap-Punkte)
- Jahr: 12 Mini-Monate mit Auftrags-Summe
- Klick auf Tag → setzt `selectedDate` im DispatchContext

### 5. Unten rechts — **Live Google Maps**
- `LiveMap`-Komponente wiederverwenden (existiert bereits)
- In Glass-Container einbetten, abgerundete Ecken
- Höhe an Quadrant angepasst (statt aspect-[4/3])

### 6. Glassmorphism-Stil
- Alle 4 Quadranten verwenden bestehende `.glass-card` Klasse aus `index.css`
- Hover-Effekt subtil (kein lift in dieser View — Quadranten sind statisch positioniert)

## Technische Details

- **Responsive:** Auf `< lg` Breakpoint vertikal stapeln (1 Spalte)
- **Datenlogik:** Bestehende React-Query-Hooks; neuer Hook `useShipmentsRange(from, to)` für Kalender
- **Keine neuen Migrations** — alle Daten existieren bereits in `shipment`, `tour`, `driver`, `vehicle`
- **Kein Mock:** Kalender zeigt echte Aufträge aus DB (Memory: keine fake Daten)

## Geänderte/neue Dateien
- `src/pages/dispatch/Tagesleitstelle.tsx` (rewrite)
- `src/components/dispatch/OrdersCalendar.tsx` (neu)
- `src/components/dispatch/WeatherWidget.tsx` (Style-Anpassung dark glass)
- `src/components/dispatch/LiveMap.tsx` (kleine Höhen-Prop)
