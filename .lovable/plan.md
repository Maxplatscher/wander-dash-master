

# Kontrollzentrale umbauen: Email-Zugang, Lieferscheine & Demo-Builder

## Überblick

Die Seite "Lieferscheine & mehr" wird komplett neu aufgebaut mit drei Bereichen:
1. **Email-Zugang** — Konfiguration für Email-Empfang von Lieferscheinen
2. **Lieferscheine-Tabelle** — Live-Ansicht aller empfangenen Sendungen (aus `shipment`-Tabelle)
3. **Demo-Builder** — Interaktive Leiste zum manuellen Erstellen von Testdaten (Fahrer, Fahrzeuge, Routen)

## Änderungen

### 1. Kontrollzentrale.tsx komplett ersetzen
- **Email-Zugang (oben)**: Karte mit Email-Adresse für Lieferschein-Empfang, Status-Anzeige, Konfigurationshinweise
- **Lieferscheine-Tabelle (Mitte)**: Tabelle mit allen Shipments aus der DB (Name, Kunde, Adresse, Gewicht, Status, Datum). Filtert nach ausgewähltem Datum. Zeigt `intake_source` und `intake_status`
- **Demo-Builder (unten, sticky Leiste)**: Formular-Bereich wo man manuell anlegen kann:
  - Fahrer hinzufügen (Name, Telefon, Schicht)
  - Fahrzeug hinzufügen (Name, Kapazität)
  - Sendungen/Lieferscheine hinzufügen
  - "Komplettes Demo-Szenario laden" Button (ruft `demo-setup` Edge Function auf)
  - "Planung starten" Button (ruft `plan-tour` auf)

### 2. Navigation-Label anpassen
- In `navigation.ts`: Label von "Lieferscheine & mehr" bleibt, aber Sidebar-Icon wird zu `Package` (statt `Radio`)

### Betroffene Dateien
- `src/pages/dispatch/Kontrollzentrale.tsx` — Kompletter Neubau
- `src/components/dispatch/DispatchSidebar.tsx` — Icon-Änderung
- Keine DB-Änderungen nötig (nutzt bestehende `shipment`, `driver`, `vehicle` Tabellen)

### Technische Details
- Lieferscheine werden via `useQuery` aus `shipment`-Tabelle geladen, gefiltert nach `selectedDate`
- Demo-Builder nutzt `supabase.from('driver').insert(...)` etc. für manuelle Einträge
- "Szenario laden" ruft `supabase.functions.invoke('demo-setup')` auf
- Email-Bereich zeigt vorerst eine Konfigurations-Karte mit Platzhalter-Email-Adresse

