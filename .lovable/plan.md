

# Datenbank-Migration: Backend-Schema nach Lovable Cloud

## Ziel
Die 10 Tabellen aus deinem bestehenden FastAPI-Backend exakt in Lovable Cloud nachbilden, inklusive E-Mail-Intake-Felder, Release-Felder und Performance-Indizes.

## Tabellen-Übersicht

| Tabelle | Zweck |
|---------|-------|
| `company` | Mandanten |
| `users` | Login-Benutzer mit Rolle |
| `driver` | Fahrer mit Schichtzeiten |
| `vehicle` | Fahrzeuge pro Mandant |
| `shipment` | Sendungen inkl. E-Mail-Intake + Freigabe-Felder |
| `email_log` | E-Mail-Verarbeitung |
| `touren_plan` | Tagesplan-Versionen |
| `plan_run` | Optimierungsläufe |
| `tour` | Einzelne Touren |
| `tour_stop` | Stops pro Tour |

## Umsetzung

### Schritt 1 — Datenbank-Migration (eine SQL-Migration)
Eine einzige Migration erstellt alle 10 Tabellen mit exakten Spalten, Typen, Foreign Keys und Indizes aus deinem `models.py` + den 3 SQL-Migrationen. Reihenfolge nach Abhängigkeiten:
1. `company` (keine FK)
2. `plan_run` (FK → company)
3. `vehicle` (FK → company)
4. `driver` (FK → company)
5. `shipment` (FK → company, alle Intake- + Release-Felder)
6. `email_log` (FK → shipment)
7. `touren_plan` (FK → company, plan_run)
8. `tour` (FK → company, touren_plan, plan_run)
9. `tour_stop` (FK → tour, vehicle, shipment)
10. `users` (FK → company, driver)
11. Performance-Indizes aus `003_performance_indexes.sql`

### Schritt 2 — RLS-Policies
- Alle Tabellen bekommen RLS aktiviert
- Policies auf `company_id`-Basis: Benutzer sehen nur Daten ihres Mandanten
- `users`-Tabelle: Nutzer sehen nur eigenes Profil
- `tour_stop`: Zugriff über die verknüpfte Tour

### Schritt 3 — Frontend-Anbindung vorbereiten
- Typen werden automatisch generiert nach Migration
- Bestehende Demo-Daten in Komponenten bleiben vorerst erhalten
- Basis für spätere Umstellung von Hardcoded → DB-Queries

## Wichtige Entscheidungen

- **UUIDs** als Primary Keys (wie im Backend)
- **`auth.users` wird NICHT referenziert** — `users`-Tabelle ist eigenständig mit `email` + `password_hash`
- **Keine Änderung** an bestehenden Frontend-Komponenten in diesem Schritt
- **Authentifizierung** wird als separater Schritt implementiert (Login/Signup mit Rollen)

## Technische Details (SQL-Auszug)

```text
company(id UUID PK, name TEXT UNIQUE)
users(id UUID PK, email TEXT UNIQUE, password_hash TEXT, company_id FK, role TEXT, is_active BOOL, driver_id FK, created_at TIMESTAMPTZ)
driver(id UUID PK, company_id FK, name TEXT, phone TEXT, status TEXT, shift_start TIME, shift_end TIME)
vehicle(id UUID PK, company_id FK, name TEXT, capacity INT)
shipment(id UUID PK, company_id FK, name TEXT, demand INT, location_x FLOAT, location_y FLOAT, window_start TIMESTAMPTZ, window_end TIMESTAMPTZ, service_date DATE, + 12 Intake/Release-Felder)
email_log(id UUID PK, message_id TEXT UNIQUE, subject TEXT, from_addr TEXT, status TEXT, error_detail TEXT, shipment_id FK, body_preview TEXT, created_at TIMESTAMPTZ, processed_at TIMESTAMPTZ)
touren_plan(id UUID PK, company_id FK, date DATE, version INT, is_active BOOL, plan_run_id FK, total_cost FLOAT, description TEXT, created_at TIMESTAMPTZ)
tour(id UUID PK, company_id FK, plan_version_id FK→touren_plan, date DATE, version INT, is_active BOOL, plan_run_id FK, total_cost FLOAT, description TEXT, created_at TIMESTAMPTZ)
tour_stop(id UUID PK, tour_id FK, vehicle_id FK, shipment_id FK, stop_index INT, arrival_time TIMESTAMPTZ, departure_time TIMESTAMPTZ, segment_cost FLOAT, driver_completed BOOL, driver_completed_at TIMESTAMPTZ)
plan_run(id UUID PK, company_id FK, created_at TIMESTAMPTZ, status TEXT, input_snapshot JSONB, result_snapshot JSONB)
```

