# Feature-Prompt für Cursor: DC-Ersteinrichtungs-Assistent (Onboarding-Wizard)

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter). `docs/CLAUDE_PROJECT_PROMPT.md` gilt weiterhin als Basis (Tech-Stack, Architektur, Arbeitsweise). **Dieser Prompt ersetzt `docs/PROMPT_CONSENT_ZEIT_STANDORT.md`** — die dortigen Punkte (Zeit/Standort-Consent) sind jetzt Teil von Schritt 5 unten.

## Auftrag

Nach der ersten Registrierung (`src/pages/Auth.tsx`, `signUp`) muss der Nutzer das DC einmalig einrichten, bevor er ins Dashboard (`DispatchDashboard`) gelangt. Baue einen mehrstufigen Wizard mit 5 Schritten: Unternehmen, Fahrer & Fahrzeuge, persönliche Daten, Farbschema, Berechtigungen.

## DB-Stand (geprüft via Supabase, Projekt `sxqbmxqnwtrgibfryvqf`)

- `company`: aktuell nur `id`, `name` — keine Adressfelder.
- `depot`: hat bereits `address`, `city`, `postal_code`, `country`, `timezone` — 1:n zu `company`.
- `driver`: `name`, `phone`, `status`, `shift_start/end`, `company_id`.
- `vehicle`: `name`, `capacity`, `company_id`.
- `users`: `email`, `company_id`, `role`, `driver_id`, `is_active` — **kein Feld für „Onboarding abgeschlossen"**.
- Kein Feld für Farbschema — aktuell clientseitig über CSS-Var-Overrides gelöst (siehe technische Schuld #6 in `CLAUDE_PROJECT_PROMPT.md`).

**Empfehlung statt Schema-Umbau von `company`:** Wizard-Schritt 1 legt `company` (nur `name`) an und direkt einen ersten `depot`-Eintrag mit den Adressdaten — passt zum bestehenden 1:n-Modell, keine neue Migration auf `company` nötig. Für „Onboarding abgeschlossen" ist eine neue Spalte `users.onboarding_completed_at timestamptz null` nötig — nur nach Rücksprache anlegen.

## Schritt 1 — Unternehmen (mit KI-Autovervollständigung)

- Input „Firmenname" mit Google Places Autocomplete. Zusätzliche Bibliothek beim Laden anfordern: `useJsApiLoader({ libraries: ['places'] })` (bestehender `VITE_GOOGLE_MAPS_API_KEY` wird weiterverwendet).
- Dropdown zeigt Vorschläge mit Name + Adresse (Building-Icon, Adresspreview, kleines „KI"-Badge — siehe gezeigtes Mockup).
- Bei Auswahl automatisch befüllen: Adresse, PLZ/Stadt aus `place.address_components`. Branche bleibt manuelle Auswahl (Places liefert keine Speditions-Branche zuverlässig). Alle Felder danach editierbar.
- **Wichtig:** In der Google Cloud Console zusätzlich zur bestehenden Maps-API die „Places API" (bzw. „Places API (New)") für den Key aktivieren, sonst `ApiNotActivatedMapError`. Bestehende HTTP-Referrer-Restriction bleibt bestehen.

## Schritt 2 — Fahrer & Fahrzeuge

Repeatable-Row-UI, „+ Fahrer hinzufügen" / „+ Fahrzeug hinzufügen", schreibt in `driver`/`vehicle` mit der `company_id` aus Schritt 1. Nicht blockierend — kann übersprungen und später in `Fahrer.tsx` nachgeholt werden.

## Schritt 3 — Persönliche Daten

Name, E-Mail (vorbefüllt aus Auth-Session), Telefon, Rolle → Update auf den bestehenden `users`-Datensatz bzw. `user_roles`.

## Schritt 4 — Farbschema

Bestehende Theme-Picker-Logik aus `Einstellungen.tsx` wiederverwenden, nur vorgezogen in den Wizard — keine neue Logik bauen.

## Schritt 5 — Berechtigungen

Ein gemeinsamer Screen mit vier einzeln togglebaren Einwilligungen (Kopplungsverbot beachten — Ablehnen darf die App nicht blockieren, Fallbacks vorsehen):

1. **Zeit/Datum** — rein informativ, keine Browser-Permission nötig.
2. **Standort** — `navigator.geolocation.getCurrentPosition()` löst den echten Browser-Permission-Prompt aus.
3. **Zugriff auf Lieferschein-Ordner** — Zweck: KI liest hochgeladene Lieferscheine automatisch aus.
4. **Betriebssystem** — Abfrage (Windows/macOS/Linux), damit die KI den richtigen lokalen Upload-/Downloadordner erkennt. Per `navigator.userAgentData`/`navigator.platform` vorschlagen, Nutzer bestätigt oder korrigiert.

Persistenz: `users.onboarding_completed_at` setzen, sobald Schritt 5 abgeschlossen ist. Einzel-Consents zunächst in `localStorage` (Key `dc_consent_v1`, siehe vorheriger Prompt) — **vor Umsetzung klären, ob die vier Einwilligungen zusätzlich serverseitig protokolliert werden müssen.**

## Routing

`src/App.tsx`: Guard nach erfolgreichem Login ergänzen — ist `users.onboarding_completed_at` leer, zu `/setup` (neue Route mit dem Wizard) weiterleiten statt zu `DispatchDashboard`. Bestehende Routen (`/auth`, `/`, `*`) nicht umbauen.

## Arbeitsweise

Schritt für Schritt umsetzen, nicht alle 5 Wizard-Screens auf einmal. Nach jedem Schritt kurz zusammenfassen, was geändert wurde. DB-Migrationen (`depot`-Insert-Logik, `users.onboarding_completed_at`) nur nach Rücksprache anlegen.

## Testen

Nach der Implementierung: eingeloggt direkt `/setup` im Browser aufrufen, um den Wizard unabhängig vom Redirect-Guard zu prüfen. Zusätzlich den vollen Flow testen — neu registrieren → Guard muss automatisch auf `/setup` weiterleiten, solange `users.onboarding_completed_at` leer ist.
