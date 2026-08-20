# DispoCenter — Projekt-Prompt für Claude (Ersatz für Lovable)

> **Zweck dieses Dokuments:** Das ist der vollständige Projekt-Kontext für DispoCenter (Codename Repo: `wander-dash-master`). Lovable fällt als Design-/UI-Tool aus dem Workflow raus — Claude übernimmt ab jetzt Design **und** Implementierung direkt (über Cursor). Dieses Dokument am Anfang eines neuen Claude-Chats/Cursor-Kontexts einfügen, damit kein Kontext verloren geht.

---

## 1. Auftrag an Claude

Du übernimmst ab sofort die Rolle, die bisher Lovable hatte: **UI-Design und Frontend-Implementierung direkt im Code**, nicht nur Review/Logik. Der Nutzer arbeitet mit **Cursor** als Editor — du lieferst vollständigen, einsetzbaren React/TypeScript-Code (keine Screenshots, keine externen Tools), den er 1:1 übernehmen kann.

Alter Workflow: `Lovable (Design) → GitHub → Cursor → Claude (nur Review/Logik) → Supabase`
Neuer Workflow: `Claude (Design + Code) → Cursor (Übernahme/Ausführung) → GitHub → Supabase`

Arbeitsweise, die der Nutzer erwartet:
- Gründliche Planung vor dem Loslegen, dann **block- bzw. sektionsweise** vorgehen (eine Seite/Komponente nach der anderen), nicht alles auf einmal umschreiben.
- Nach jedem Block kurz zusammenfassen, was geändert wurde, damit der Nutzer gegenprüfen kann.
- Deutsch als Kommunikationssprache, direkt und technisch, wenig Drumherum.
- Bestehende Datenlogik, Hooks, Routing, Auth **nicht anfassen**, sofern nicht explizit gefragt — reine Visual-/Struktur-Arbeit trennen von Logik-Änderungen.

---

## 2. Projektüberblick

**DispoCenter (DC)** ist eine Logistik-Dispositions-Webanwendung für Tagesplanung, Touren-/Fahrerverwaltung, Sendungsverwaltung und KI-gestützte Disposition. Zielgruppe: Speditions-Disponenten. Status: nähert sich Pilotreife, aktuell Testdaten/Dev-Stand (Produktivdaten noch nicht vorhanden).

Frühere Vorstufe des Projekts hieß „Easy Planning" (FastAPI + Vanilla JS) und wurde vollständig auf React migriert — Reste davon liegen (bewusst ausgeklammert) in `legacy/`.

---

## 3. Tech-Stack

- **Frontend:** React 18 + TypeScript, Vite 5, React Router v6
- **Styling:** Tailwind CSS 3 + shadcn/ui (Radix-Primitives) + eigenes Glassmorphism-Design-System (siehe Abschnitt 6)
- **State/Data:** TanStack React Query (`useQuery`/`useQueryClient`) für Server-State, React Context (`DispatchContext`, `AuthContext`) für App-State
- **Backend:** Supabase (Postgres + Auth + Edge Functions + RLS). Projekt-ID: `sxqbmxqnwtrgibfryvqf` (Name „DC Project", Region eu-central-1). Kein Python/FastAPI mehr im aktiven Code.
- **KI-Feature:** Gemini API für Tourenplanung/Problemlösung (`ai-resolve`, `plan-tour` Edge Functions)
- **Karten:** Google Maps JavaScript API (`@react-google-maps/api`)
- **Wetter:** Open-Meteo API (kostenlos, kein Key nötig)
- **Testing:** Vitest (Unit), Playwright (E2E) — aktuell nur ein Beispieltest vorhanden
- **Paketmanager:** npm (package-lock.json vorhanden) — es liegen auch `bun.lock`/`bun.lockb` im Repo, npm ist aber der aktuell genutzte Weg

---

## 4. Architektur & Routing

```
src/main.tsx                     → Einstiegspunkt, mountet <App />
src/App.tsx                      → Router-Setup: /auth, / (geschützt), * (404)
src/pages/Auth.tsx                → Login/Registrierung (Supabase Auth, Email+Passwort)
src/pages/DispatchDashboard.tsx  → Haupt-Layout: Sidebar + Topbar + Section-Switching (Hash-Routing, kein echtes React-Router-Nesting)
src/pages/NotFound.tsx            → 404-Seite
src/pages/Index.tsx               → verwaist / nicht geroutet (Alt-Lastenrelikt, siehe Abschnitt 8)
```

**Navigation:** Es gibt keine echten Unterrouten — `DispatchDashboard` hält einen `currentSection`-State (`SectionId`) im `DispatchContext`, gesteuert über den URL-Hash (`#tagesleitstelle` etc., siehe `src/lib/navigation.ts`). Sidebar-Klick → `navigateTo(id)` → `history.replaceState` + State-Update.

**7 Sektionen** (`src/lib/navigation.ts`), jede eine eigene Seite unter `src/pages/dispatch/`:

| ID | Label | Datei | Rendert echte DB-Daten? |
|---|---|---|---|
| `tagesleitstelle` | Tagesleitstelle | `Tagesleitstelle.tsx` | Ja |
| `operative-lage` | Operative Lage | `OperativeLage.tsx` | Ja |
| `kalender` | Kalender | `Kalender.tsx` | **Nein — Demo-Events hardcodiert** |
| `kontrollzentrale` | Lieferscheine & mehr | `Kontrollzentrale.tsx` | Ja (Sendungen), Rest Demo-Buttons |
| `fahrer` | Fahrer & Fahrzeuge | `Fahrer.tsx` | **Nein — 6 Fahrer hardcodiert** |
| `einstellungen` | Einstellungen | `Einstellungen.tsx` | Teilweise (Theme lokal, Integrationen aus DB) |
| `probleme` | Probleme | `Probleme.tsx` | Ja |

`Versionen.tsx` existiert (`src/pages/dispatch/Versionen.tsx`) mit komplett hardcodierten Plan-Versionen, ist aber **in keiner Sektion/Route eingebunden** — totes/unfertiges Feature.

**Rollen:** `admin`, `dispatcher`, `driver` (aus `user_roles`-Tabelle bzw. RPC `get_my_role`). `Fahrer.tsx` zeigt bei Rolle `driver` eine andere Ansicht (`DriverTourView.tsx`, ebenfalls mit hardcodierten Demo-Stops). `RoleGuard.tsx` als generische Rollen-Sichtbarkeits-Komponente vorhanden, aber aktuell kaum genutzt.

---

## 5. Dateiübersicht (vollständig)

### Konfiguration & Tooling
- `package.json` — Dependencies (React 18, Vite 5, shadcn/Radix, TanStack Query, Supabase-JS, Google Maps, Recharts, Framer Motion, Zod, React Hook Form, Vitest, Playwright)
- `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `playwright-fixture.ts` — Build-/Test-Konfiguration
- `tailwind.config.ts` — Theme-Tokens (siehe Abschnitt 6), Farb-/Radius-/Animation-Mapping auf CSS-Variablen
- `postcss.config.js`, `eslint.config.js`, `components.json` (shadcn-Konfig), `tsconfig*.json`
- `.env` (lokal, nicht in Git) — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `.lovable/plan.md` — letzter Lovable-Arbeitsauftrag (Tagesleitstelle-Redesign, bereits umgesetzt) — kann nach Migration weg
- `docs/LOVABLE_PROMPT_DESIGN_REDESIGN.md` — der ursprüngliche Lovable-Redesign-Prompt (Dark Glassmorphism). **Die darin definierten Design-Tokens sind bereits vollständig in `index.css`/`tailwind.config.ts` umgesetzt** — dieses Dokument hier ersetzt ihn als aktive Arbeitsgrundlage.

### App-Einstieg & Routing
- `src/main.tsx` — ReactDOM-Root
- `src/App.tsx` — Router, QueryClientProvider, Toaster-Setup
- `src/App.css`, `src/index.css` — globale Styles + Design-System (siehe Abschnitt 6)
- `src/vite-env.d.ts` — Vite-Typen

### State & Auth
- `src/hooks/useAuth.tsx` — Supabase-Auth-Context (Sign-in/up/out, Rollen-Fetch via RPC `get_my_role`)
- `src/lib/dispatch-context.tsx` — App-weiter Zustand: aktive Sektion, Mandant (`tenant`, aktuell 3 Fake-Mandanten „Mandant A/B/C"), gewähltes Datum, Rolle, `refreshKey` für manuelles Query-Invalidieren
- `src/lib/navigation.ts` — Sektions-Definitionen + Hash-Routing-Helper
- `src/lib/utils.ts` — `cn()` (clsx+tailwind-merge)

### Supabase-Integration
- `src/integrations/supabase/client.ts` — Supabase-Client (liest `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`)
- `src/integrations/supabase/types.ts` — generierte DB-Typen (nicht manuell editieren)
- `src/hooks/useIntegrations.ts` — CRUD für `system_integrations` via RPCs (`upsert_integration`, `delete_integration_with_secret`)
- `src/types/integrations.ts` — Typen/Feldkonfiguration für die 5 Integrationstypen (ERP, Telematik, E-Mail/IMAP, REST API, CSV/SFTP)

### Seiten (`src/pages/dispatch/`)
- `Tagesleitstelle.tsx` — 2×2-Grid: Wetter, KPI-Block „Today's Highlight", Auftrags-Kalender (`OrdersCalendar`), Live-Karte. **Bereits im finalen Glass-Design.**
- `OperativeLage.tsx` — Willkommens-Banner, 4 Fahrer-KPI-Kacheln (Farbverlauf-Karten, nicht Glass), Fahrer-Fortschritt + Live-Karte. **Teilweise Glass-Design**, „Fahrer hinzufügen"-Dialog mit echtem DB-Insert.
- `Kalender.tsx` — Monats-/Wochen-/Tagesansicht. **Altes helles shadcn-Card-Design (`bg-card`, `border-border`), Events sind hardcodierte Demo-Daten (`demoEvents`), keine DB-Anbindung.**
- `Kontrollzentrale.tsx` — E-Mail-Zugang-Platzhalter, Sendungstabelle (echte Daten aus `shipment`), Demo-Builder (Fahrer/Fahrzeug manuell anlegen, „Demo-Szenario laden" → Edge Function `demo-setup`, „Planung starten" → Edge Function `plan-tour`). **Altes Card-Design.**
- `Fahrer.tsx` — Fahrer-Grid. **Komplett hardcodierte Fahrerliste (6 fiktive Namen), keine DB-Anbindung.** Bei Rolle `driver` wird stattdessen `DriverTourView` gerendert.
- `Einstellungen.tsx` — 5 Unterbereiche: UI (Theme-Presets über CSS-Var-Overrides + localStorage), Betrieb (hardcodiert), System (Cache leeren funktioniert, Rest Platzhalter), Integrationen (echte DB-Anbindung über `IntegrationenSektion`), Benutzer (nur Text-Platzhalter). **Altes Card-Design**, Theme-Picker kollidiert konzeptionell mit dem fest verdrahteten Dark-Glass-Design (siehe Abschnitt 8).
- `Probleme.tsx` — Erkennt echte Probleme aus der DB (unzugeordnete Sendungen, Zeitfensterkonflikte in `tour_stop`, abwesende Fahrer), inkl. KI-Auflösung über Edge Function `ai-resolve`. Exportiert `useProblems()`, das auch in `OperativeLage.tsx` genutzt wird. **Altes Card-Design.**
- `Versionen.tsx` — Plan-Versionsverwaltung UI, komplett hardcodiert, **nicht geroutet/erreichbar**.

### Komponenten (`src/components/dispatch/`)
- `KpiCard.tsx` — wiederverwendbare KPI-Kachel (Glass-Design, animierte Zahl, 4 Varianten: default/success/warning/destructive)
- `KpiDetailDialog.tsx` — Klick auf KPI öffnet Detail-Liste (lädt echte Daten je nach Typ: Touren/Fahrzeuge/Fahrer/unzugeordnete Sendungen; „conflicts" ist aktuell hart auf leere Liste gesetzt)
- `DriverDetailDialog.tsx` — Fahrer-Detailansicht mit echten Tour-Stops aus DB, aber **Kartenposition ist hardcodiert auf Berlin** (kein echtes Live-Tracking)
- `DriverTourView.tsx` — „Meine Tour heute" für Fahrer-Rolle, **komplett mit 6 hardcodierten Fake-Stops in Berlin**
- `LiveMap.tsx` — Google-Maps-Komponente mit **4 hardcodierten Fake-Fahrer-Markern**, keine echten Standortdaten
- `WeatherWidget.tsx` — Open-Meteo-Integration, echte Live-Daten, Stadtsuche funktioniert, bereits im Glass-Design
- `OrdersCalendar.tsx` — Auftragskalender mit 4 Ansichten (Tag/Woche/Monat/Jahr), lädt echte `shipment`-Daten, bereits im Glass-Design
- `ParticleBackground.tsx` — Canvas-Partikelanimation im Hintergrund (aktuell violett/`#a78bfa`, passt farblich nicht ganz zum blauen Akzent des restlichen Designs — siehe Abschnitt 8)
- `RoleGuard.tsx` — generische Rollen-Sichtbarkeitskomponente

### Komponenten (`src/components/settings/`)
- `IntegrationenSektion.tsx` — vollständiges CRUD für System-Integrationen (5 Typen), inkl. Verbindungstest (Edge Function `test-integration`, mit SSRF-Schutz), Confirm-Dialog beim Löschen, Secrets werden serverseitig ins Vault-Pattern verschoben (`credentials_enc`-Spalte als Interimslösung)

### Verwaiste Komponenten (nirgends importiert außer sich gegenseitig — Kandidaten zum Löschen)
- `src/pages/Index.tsx`, `src/components/AppSidebar.tsx`, `src/components/NavLink.tsx`, `src/components/StatCard.tsx`, `src/components/TourCard.tsx`, `src/components/dispatch/DispatchSidebar.tsx` — Reste einer früheren Layout-Version, nicht mehr geroutet/eingebunden

### shadcn/ui Primitives (`src/components/ui/*`)
~40 Standard-shadcn-Komponenten (Button, Card, Dialog, Select, Table, Sheet, Tabs, Toast, etc.) — unverändertes shadcn, bezieht Farben automatisch aus den globalen CSS-Variablen. Bei Design-Arbeiten i.d.R. nicht einzeln anfassen.

### Supabase (`supabase/`)
- `config.toml` — `project_id = sxqbmxqnwtrgibfryvqf` (DC Project)
- `functions/demo-setup/` — legt Demo-Company mit Fahrern/Fahrzeugen/Sendungen an
- `functions/plan-tour/` — einfache Tourenplanung (Manhattan-Distanz-Heuristik, kapazitätsbasiert)
- `functions/ai-resolve/` — KI-gestützte Problemlösung (unzugeordnete Sendungen zuordnen, Zeitkonflikte neu planen) — nutzt vermutlich Gemini API
- `functions/test-integration/` — testet System-Integrationsverbindungen, mit SSRF-Schutz (blockiert Loopback/Private-IPs/Cloud-Metadata)
- `functions/create-admin/` — legt Admin-User an/aktualisiert Rolle
- `migrations/` — 6 SQL-Migrationen (Basis-Schema, Phase-1-Depot/Integrationen, Phase-3-Cleanup, aktuellster Fix: `GRANT SELECT ON users`)
- `sql/000_full_base_schema.sql` — vollständiges Basisschema als Referenz

---

## 6. Design-System (bereits aktive Source of Truth — NICHT neu erfinden)

Das dunkle Glassmorphism-Design aus `docs/LOVABLE_PROMPT_DESIGN_REDESIGN.md` ist **bereits vollständig als globales Theme umgesetzt** in `src/index.css` (CSS-Variablen, HSL-Format) und `tailwind.config.ts` (Tailwind-Farb-Mapping). Das ist der aktuelle Ist-Zustand, nicht nur eine Zielvorgabe:

```css
--background: 222 44% 7%        /* #0a0e1a — Basis-Hintergrund */
--card: 224 38% 12%             /* #11172a */
--primary: 212 100% 65%         /* #4ea0ff — Akzent-Blau */
--muted-foreground: 220 15% 60% /* #8a94a8 */
--border: 224 25% 22%
--radius: 1.5rem                /* 24px Standard-Radius */
--success: 142 76% 65% / --warning: 38 90% 62% / --danger: 0 100% 71%
```

Wiederverwendbare Klassen (`@layer components` in `index.css`):
- `.glass-card` — `background: hsl(0 0% 100% / 0.04)`, `backdrop-filter: blur(20px) saturate(140%)`, Border `hsl(0 0% 100% / 0.08)`, `border-radius: 24px`, weicher Schatten. Hover: leicht hellerer Background.
- `.glass-card-elevated` — gleiche Optik, aber solider Hintergrund (`--bg-elevated`) statt transparent — für Sidebar/Topbar
- `.glass-pill` — für Pill-Buttons/Filter
- `.hover-lift` — `translateY(-2px)` + verstärkter Schatten on hover
- `.section-title` — kleine, gesperrte Überschriften (uppercase, tracking-widest)

Schrift: Inter (Google Fonts, bereits importiert). Radius-System: `rounded-3xl`/24px für Hauptkarten, `rounded-2xl` für Sub-Karten, `rounded-xl` für Buttons.

**Regel für jede weitere Design-Arbeit:** Nur diese CSS-Variablen und `.glass-card`-Klassen verwenden, keine neuen Farbwerte hart codieren, keine `bg-white`/`text-gray-*`/helle Tailwind-Defaults mehr einsetzen.

---

## 7. Was schon fertig ist vs. was noch aussteht

**Bereits im finalen Glass-Design:** `Tagesleitstelle.tsx`, `WeatherWidget.tsx`, `OrdersCalendar.tsx`, `KpiCard.tsx`, `DispatchDashboard.tsx` (Sidebar/Topbar-Layout), größtenteils `OperativeLage.tsx`.

**Noch im alten hellen shadcn-Standard-Look** (funktioniert technisch, aber visuell inkonsistent zum Rest): `Kalender.tsx`, `Kontrollzentrale.tsx`, `Fahrer.tsx`, `Einstellungen.tsx`, `Probleme.tsx`, `DriverTourView.tsx`, `DriverDetailDialog.tsx` (Body-Bereich), `IntegrationenSektion.tsx`, `KpiDetailDialog.tsx` (Listeneinträge).

Das ist der Hauptauftrag für die Weiterarbeit: **die restlichen Seiten auf `.glass-card` + die bestehenden CSS-Variablen umziehen**, exakt wie es bei `Tagesleitstelle.tsx` schon gemacht wurde — ohne Datenlogik, Props, Query-Keys oder Funktionsnamen zu verändern.

---

## 8. Bekannte offene Punkte / technische Schulden

1. **Google Maps API-Key (Phase 9):** Code-seitig erledigt — nur noch `VITE_GOOGLE_MAPS_API_KEY` in `.env` / `src/lib/google-maps.ts`. Offen: in Google Cloud Console HTTP-Referrer-Restriction setzen und jeden jemals geleakten/alten Key rotieren (löschen).
2. **Mock-/Fake-Daten statt echter DB-Anbindung** in: `Fahrer.tsx` (6 hardcodierte Fahrer), `Kalender.tsx` (`demoEvents`), `DriverTourView.tsx` (6 Fake-Stops in Berlin), `LiveMap.tsx` (4 Fake-Marker), `DriverDetailDialog.tsx` (Kartenposition fix auf Berlin), `Versionen.tsx` (komplett). Das widerspricht dem im Projekt dokumentierten Grundsatz „keine Mock-Daten, nur echte DB-Werte".
3. **`supabase/config.toml`** — erledigt (`sxqbmxqnwtrgibfryvqf`).
4. **`Versionen.tsx` ist nicht geroutet** — entweder in die Navigation einbinden oder als totes Feature entfernen.
5. **Verwaiste Alt-Komponenten** (`Index.tsx`, `AppSidebar.tsx`, `NavLink.tsx`, `StatCard.tsx`, `TourCard.tsx`, `DispatchSidebar.tsx`) — Cleanup-Kandidaten.
6. **Theme-Picker in `Einstellungen.tsx`** erlaubt 6 Farbschemata über CSS-Var-Overrides (Teal/Blau/Violett/Orange/Grün/Rot) — kollidiert konzeptionell mit dem jetzt fest verdrahteten Dark-Glass-Design. Sollte entweder entfernt oder als „Akzentfarbe innerhalb des Dark-Themes" neu gedacht werden.
7. **`ParticleBackground.tsx`** nutzt noch violette Partikelfarbe (`#a78bfa`), während der Rest des Designs auf Blau/Cyan (`--accent-blue`/`--accent-cyan`) läuft — visuelle Inkonsistenz.
8. **Supabase-Projekt pausiert bei Inaktivität** (Free-Tier) — beim letzten Neustart waren alle Tabellen leer (0 Zeilen), inkl. des Test-Admin-Users. Vor dem Weiterarbeiten prüfen, ob ein Test-User/Testdaten neu angelegt werden müssen (z. B. über die `demo-setup`-Edge-Function oder `create-admin`).

---

## 9. Datenmodell (Supabase, Schema `public`)

Alle Tabellen mit RLS aktiviert, aktuell 0 Zeilen (siehe Punkt 8 oben).

- **company** — Mandant (id, name)
- **depot** — Standort pro Company (name, code, address, city, postal_code, country, timezone, metadata)
- **driver** — Fahrer (name, phone, status, shift_start/end, company_id)
- **vehicle** — Fahrzeug (name, capacity, company_id)
- **shipment** — Sendung (customer_name, delivery_address, weight_kg, service_date, window_start/end, intake_source/status, raw_email, positionen (jsonb), email_received_at/processed_at, missing_fields)
- **tour** / **touren_plan** — Tour bzw. versionierter Tourenplan pro Tag (date, version, is_active, plan_run_id, total_cost)
- **tour_stop** — einzelner Stop innerhalb einer Tour (stop_index, arrival/departure_time, driver_completed, segment_cost, verweist auf shipment + vehicle)
- **plan_run** — Protokoll eines Planungslaufs (input/result_snapshot als jsonb, status)
- **email_log** — Log eingehender Lieferschein-E-Mails
- **users** — App-User (email, company_id, role, driver_id, is_active) — **eigene Tabelle, nicht `auth.users`**
- **user_roles** — Rollenzuordnung (enum `app_role`: admin/dispatcher/driver), verweist auf `auth.users`
- **system_integrations** — externe Systemanbindungen (`system_type`, `name`, `config`, optional `vault_secret_id`, Teststatus); Zugangsdaten liegen ausschließlich im Supabase Vault und werden über Edge Functions verwaltet

Wichtige RPCs: `get_my_role`, `get_user_company_id`, `upsert_integration`, `delete_integration_with_secret`.

---

## 10. Nächste konkrete Schritte (Vorschlag für die erste Session mit Claude/Cursor)

1. `Kalender.tsx` auf Glass-Design umstellen + echte `shipment`-Daten statt `demoEvents` (kann sich stark an `OrdersCalendar.tsx` orientieren, das bereits beides — Glass-Design und echte Daten — hat)
2. `Kontrollzentrale.tsx`, `Probleme.tsx`, `Einstellungen.tsx` auf Glass-Design umstellen (reines Styling, keine Logikänderung)
3. `Fahrer.tsx` von hardcodierten Daten auf echte `driver`/`vehicle`-Query umstellen + Glass-Design
4. Google-Maps-Key: Referrer in GCP setzen + alten Key rotieren (Code nutzt bereits `.env`)
5. ~~`supabase/config.toml` korrigieren~~ (erledigt)
6. Entscheidung einholen: `Versionen.tsx` und die verwaisten Alt-Komponenten behalten/einbinden oder löschen

Bitte jeden dieser Punkte einzeln umsetzen und nach jedem Schritt kurz Rückmeldung geben, bevor der nächste beginnt (siehe Arbeitsweise in Abschnitt 1).
