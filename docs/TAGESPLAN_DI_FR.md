# Tagesplan Dienstag–Freitag (18.–21.08.2026)

> Stand: Montagabend, 17.08.2026. Basis: aktueller Repo-Zustand geprüft (Supabase-Projekt `sxqbmxqnwtrgibfryvqf`, lokaler Git-Stand).

## Wichtigster Befund vorab

**Im Supabase-Projekt ist aktuell keine einzige Edge Function deployed** (`list_edge_functions` liefert leer, auch `assign-depot`, `plan-tour`, `ai-resolve`, `upsert-integration` fehlen remote). Das heißt: Lieferschein-Verarbeitung, Tourenplanung, Depot-Zuordnung, Integrationen speichern/testen und die neue Artikel-Recherche funktionieren gerade nicht, unabhängig vom Frontend-Stand. Das ist der Blocker Nr. 1 für Dienstagmorgen.

Außerdem liegt einiges an fertigem, aber uncommittetem Code lokal (Artikel/Packmittel-Feature, Startseite-Redesign, Fahrer-Visitenkarten-Modal) — noch nicht auf GitHub gepusht.

---

## Dienstag — Fundament herstellen

1. Alle Edge Functions deployen (`assign-depot`, `plan-tour`, `ai-resolve`, `upsert-integration`, `test-integration`, `create-admin`, `demo-setup`, `research-article`). Ohne das läuft kein KI-/Backend-Feature in Produktion.
2. Offenen Arbeitsstand committen und pushen (aktuell u. a. `Startseite.tsx`, `StepFleet.tsx`, `Kontrollzentrale.tsx`, `Kalender.tsx`, Artikel/Packmittel-Feature, Integrationstyp `research_source`) — sonst geht Cursor-Fortschritt bei nächstem Sync verloren.
3. Kompletten Onboarding-Wizard (Schritt 1–5) nochmal end-to-end durchklicken, inkl. neuem Fahrer-Visitenkarten-Modal — prüfen ob Foto-Upload einen Storage-Bucket braucht (aktuell **kein** Bucket im Projekt vorhanden, siehe `docs/PROMPT_FAHRER_VISITENKARTE_MODAL.md`).
4. Kurzer Realitäts-Check: Google-Places-Key funktioniert nur auf `localhost`/`192.168.178.43` (HTTP-Referrer) — sobald eine Domain für Tests/Demo feststeht, dort ergänzen.

## Mittwoch — Kernfeatures fertigstellen

1. Artikel-KI-Recherche end-to-end testen: Branchen-Website als Integration hinterlegen (`research_source`), `research-article` mit einem echten unbekannten Artikel triggern, Vorschlag im `ArticleReviewPanel` prüfen und bestätigen.
2. Startseite-Redesign fertig gegen das Figma-Referenzdesign abgleichen: Grußkarte, einheitliche 6er-KPI-Reihe, „Fahrer-Fortschritt"-Panel, Wetter-Widget um Niederschlag + Stundenvorschau erweitern.
3. Sidebar-Navigation bereinigen: „Tagesleitstelle" und „Operative Lage" sind jetzt in „Startseite" zusammengeführt — Menüpunkte/Reihenfolge/Icons final an Figma angleichen.

## Donnerstag — Richtung Tourenplanung

1. `vehicle`-Tabelle um Laderaum-Maße (Länge/Breite/Höhe) ergänzen — Vorbereitung für spätere 3D-Packing-Logik, gleiches manuelles Pflege-Prinzip wie heute.
2. Prüfen, wie `artikel`/`packmittel`-Daten später in `plan-tour` einfließen (aktuell rechnet die Funktion nur mit `weight_kg`/`demand`, keine Volumen-Logik) — Konzept statt Umsetzung, damit das nicht überstürzt passiert.
3. Rest der bekannten technischen Schulden abarbeiten (aus `CLAUDE_PROJECT_PROMPT.md` Abschnitt 8): Mock-Daten in `Fahrer.tsx`, `Kalender.tsx`, `DriverTourView.tsx` durch echte DB-Werte ersetzen; verwaiste Alt-Komponenten (`Index.tsx`, `AppSidebar.tsx`, `NavLink.tsx`, `StatCard.tsx`, `TourCard.tsx`, `DispatchSidebar.tsx`) aufräumen oder entfernen; `ParticleBackground`-Farbe (aktuell Violett) auf Blau/Cyan angleichen; Theme-Picker-Kollision mit dem festen Dark-Design klären.

## Freitag — Qualitätssicherung & Abschluss

1. Kompletter End-to-End-Test: Registrierung → Onboarding → Startseite → Lieferschein hochladen → Artikel-Erkennung/Bestätigung → Tourenplanung auslösen.
2. RLS-Review der neuen Tabellen `artikel`/`packmittel` (Muster ist korrekt gesetzt, einmal gegenprüfen — genau solche Policy-Bugs haben diese Woche schon zweimal geblockt).
3. Entscheidung zu `Versionen.tsx` einholen (routen oder als totes Feature entfernen) — offener Punkt seit `CLAUDE_PROJECT_PROMPT.md`.
4. Puffer für Bugfixing aus den Tagen davor — bewusst nichts Neues mehr anfangen.

---

## Arbeitsweise

Wie bisher: nach jedem größeren Block kurz testen und Rückmeldung geben, nicht alles gleichzeitig anfassen. Migrationen/Deploys über diese Session laufen lassen, Frontend-Umsetzung über Cursor.
