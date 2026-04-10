

# Plan: Cursor-Backend + Frontend in Lovable Cloud migrieren

## Ausgangslage

Dein Cursor-Projekt (GitHub: `Maxplatscher/Disponenten--KI`) hat:
- **FastAPI-Backend** mit OR-Tools Optimizer, Tourenplanung, Versionierung, E-Mail-Intake, Fahrer-Fortschritt
- **Einfaches HTML-Frontend** (single-page index.html)

Dein Lovable-Projekt hat bereits:
- Die richtige **Datenbank-Struktur** (company, vehicle, shipment, driver, tour, tour_stop, touren_plan, plan_run, email_log, users) mit RLS-Policies
- Ein **Frontend-Gerüst** mit Sidebar, Kontextbar, und Seiten (Tagesleitstelle, Operative Lage, Kalender, Kontrollzentrale, Fahrer, Probleme, Einstellungen)
- Aktuell nur **statische Mock-Daten** im Frontend

## Migrations-Strategie

Da Lovable kein Python/FastAPI laufen lassen kann, wird die Backend-Logik so aufgeteilt:
- **Einfache CRUD-Operationen** (Vehicles, Shipments, Drivers, Tours) → direkt über den Supabase-Client im Frontend
- **Komplexe Logik** (Optimizer/Planlauf, Demo-Szenarien, Versionsvergleich, Operations-Snapshot) → Backend-Funktionen (Edge Functions)

---

## Phase 1: Backend-Logik als Edge Functions

### 1.1 Tourenplanung (Optimizer)
- Edge Function `plan-tour` die den OR-Tools Optimizer als vereinfachten Greedy-Algorithmus nachbaut (OR-Tools läuft nicht in Deno)
- Eingabe: company_id, date, locked_shipment_ids, preassigned, auto_activate
- Liest Vehicles + Shipments aus der DB, berechnet Distanzmatrix (Manhattan), plant Routen
- Erstellt Tour, TourStops, PlanVersion, PlanRun in der DB

### 1.2 One-Click Demo
- Edge Function `demo-setup` die Demo-Company + Vehicles + Shipments anlegt (Szenario A/B)
- Ruft danach `plan-tour` intern auf

### 1.3 Tour aktivieren
- Edge Function `activate-tour` die die aktive Version wechselt

### 1.4 Dispatcher Operations Snapshot
- Edge Function `operations-snapshot` die den aggregierten Fortschritt liefert (Fahrzeuge, Stops done/open, Progress)

### 1.5 Versionsvergleich (Deltas)
- Edge Function `version-deltas` die Versionen vergleicht und Delta-Hinweise generiert

---

## Phase 2: Frontend an Live-Daten anbinden

### 2.1 Tagesleitstelle (Startseite)
- KPIs aus DB laden (aktive Touren, Fahrzeuge, Fahrer, Unassigned, Konflikte)
- "Plan öffnen" → ruft tatsächlich die Plan-Edge-Function auf
- "One-Click Demo" → ruft Demo-Edge-Function auf
- Szenarien A/B funktional machen

### 2.2 Operative Lage
- Operations-Snapshot aus Edge Function laden
- Fahrer-Auslastung und Touren-Fortschritt aus DB
- Live-Karte mit echten Koordinaten (Leaflet/OpenStreetMap)

### 2.3 Kontrollzentrale (Lieferscheine & mehr)
- Shipments aus DB laden und anzeigen
- Versionsvergleich mit echten Deltas
- Tour-Aktivierung

### 2.4 Fahrer & Fahrzeuge
- CRUD für Fahrer und Fahrzeuge über Supabase-Client
- Fahrer-Status anzeigen

### 2.5 Probleme
- Unassigned Shipments und Konflikte aus der letzten Planung anzeigen
- Email-Intake-Logs anzeigen

### 2.6 Fahrer-Ansicht (Driver View)
- Eigene Tour laden (aktive Tour für heute)
- Stops als Checkliste mit "Erledigt"-Button
- Fortschrittsanzeige

---

## Phase 3: Authentifizierung

- Login/Signup mit E-Mail + Passwort über Lovable Cloud Auth
- Rollen-System (Admin/Dispatcher/Driver) über separate `user_roles`-Tabelle
- Rollenbasierte Sichtbarkeit der Sidebar und Features
- Den Dev-Rollen-Switcher durch echte Auth ersetzen

---

## Reihenfolge der Umsetzung

Die Phasen werden schrittweise gebaut, da das Projekt sehr umfangreich ist. Vorgeschlagene Reihenfolge:

1. **Auth + Rollen** (Basis für alles weitere)
2. **Demo-Setup Edge Function** (um schnell Testdaten zu haben)
3. **Planungs-Edge-Function** (Kern-Feature)
4. **Tagesleitstelle mit Live-Daten**
5. **Operative Lage mit echten Daten**
6. **Kontrollzentrale + Versionsvergleich**
7. **Fahrer & Fahrzeuge CRUD**
8. **Probleme-Seite**
9. **Driver View**

---

## Technische Details

- **Optimizer**: OR-Tools (Python) kann nicht 1:1 portiert werden. Stattdessen ein Greedy-Nearest-Neighbor-Algorithmus in TypeScript/Deno, der Kapazitäts- und Zeitfenster-Constraints berücksichtigt. Für einen späteren Produktivbetrieb könnte ein externer Optimierungsdienst angebunden werden.
- **Distanzmatrix**: Manhattan-Distanz wie im Original, mit Option für spätere OSRM-Anbindung.
- **Koordinaten**: Weiterhin lon/lat * 10.000 als Integer-Kodierung.
- **DB-Anpassungen**: Die bestehende Struktur ist bereits passend. Kleinere Ergänzungen (z.B. `driver_id` Foreign Key auf tour_stop) werden als Migrationen durchgeführt.

