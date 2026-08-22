# Checkliste vor Verkauf/Launch — DispoCenter

> Stand: 22.08.2026, nach dem Samstags-Fahrerbetrieb. `docs/CLAUDE_PROJECT_PROMPT.md` ist an mehreren Stellen veraltet — z. B. sind die dort gelisteten Alt-Komponenten und `Versionen.tsx` bereits entfernt, `Fahrer.tsx`/`Kalender.tsx` laufen bereits auf echten Daten. Diese Liste ersetzt den technischen Teil davon.

## A. Kernfunktionen, die noch nicht echt sind (Blocker)

1. **Live-Standortkarte (`LiveMap.tsx`)** — Demo-Marker sind entfernt; die Karte heißt „Tourposition". Marker kommen aus geokodierten Stop-Adressen (`geocode-shipments`). Es gibt weiterhin **keine GPS-Quelle** — Details in `docs/KARTE_STANDORTQUELLE.md`.
2. **„Meine Tour heute" für Fahrer-Rolle (`DriverTourView.tsx`)** — erledigt am 22.08.2026. Ein Fahrer sieht über `users.driver_id` → `tour.driver_id` seine aktive Tagestour, schließt Stops über die RPC `complete_my_tour_stop` ab, und der Status bleibt nach Reload in `tour_stop` gespeichert. Navigation zeigt nur „Meine Tour"; der Firmen-Wizard unter `/setup` wird für Fahrer übersprungen.
3. **E-Mail/IMAP-Import für Lieferscheine** — in `Kontrollzentrale.tsx` nach wie vor nur ein Platzhalter („Ausstehend", feste Beispiel-Adresse `lieferscheine@dispatch.example.com`). Keine echte IMAP-Anbindung, kein automatisches Anlegen von `shipment`-Zeilen aus Mails. Das ist aber genau die Berechtigung, die im Onboarding-Wizard bereits abgefragt wird („Zugriff auf Lieferscheine erlauben") — Erwartung vs. Funktion klaffen auseinander.

## B. Sicherheit

4. Security-Advisor am 22.08.2026 erneut geprüft: `function_search_path_mutable` auf `set_updated_at` ist behoben; `anon` hat kein EXECUTE mehr auf `encrypt`/`decrypt_integration_secret`, `ensure_default_company` und `handle_new_user`. Fahrer können Stammdaten und Integrationen nicht mehr schreiben; `delete_integration_with_secret` prüft Admin/Dispatcher. Verbleibend (WARN, bewusst): `authenticated` darf die für RLS/App nötigen SECURITY-DEFINER-Funktionen (`get_my_role`, `get_user_company_id`, `has_role`, `complete_my_tour_stop`, `get_current_driver_id`, `delete_integration_with_secret`) ausführen. „Leaked Password Protection" ist in Supabase Auth deaktiviert — vor Live-Betrieb aktivieren. Das Passwort des Testaccounts liegt im Git-Verlauf (Commit `0df1dfd`) und muss vor Verkauf rotiert werden.
5. Google Cloud: HTTP-Referrer-Einschränkung für den Maps-Key gilt bisher nur für `localhost`/LAN-IP — sobald eine Produktionsdomain feststeht, dort ergänzen (sonst blockt Places/Maps live).

## C. Tourenplanung/KI — Tiefe fehlt noch

6. `plan-tour` rechnet weiterhin nur 1-dimensional mit Gewicht (`weight_kg`/`demand`) und einer Manhattan-Distanz-Heuristik — keine Volumen-/Packmittel-Logik, obwohl `artikel`/`packmittel`-Tabellen bereits existieren. Die Verknüpfung „Artikelmaße → Ladevolumen → Tourenplanung" ist konzeptionell offen (war als Donnerstag-Punkt vorgesehen).
7. `vehicle`-Tabelle hat noch keine Laderaum-Maße (Länge/Breite/Höhe) — Voraussetzung für Punkt 6.
8. Artikel-KI-Recherche (`research-article`/`ArticleReviewPanel`) ist mit Serper end-to-end getestet: konkrete Herstellerquelle, 95 % Confidence und verifizierte Produktmaße. Gemini Google Search bleibt als Fallback eingebaut; quelllose Schätzungen werden bewusst abgelehnt.

## D. Fehlende Infrastruktur

9. Fahrerfoto-Storage: privater Bucket `driver-photos` (JPEG/PNG/WebP, max. 2 MB), RLS nach Company, Schreiben nur Disposition. Upload in „Fahrer hinzufügen“, Fahrer-Dialog und Onboarding; `photo_url` speichert den Storage-Pfad.
10. Onboarding-Wizard fragt weiterhin ein Farbschema ab (`StepTheme.tsx`, `theme-presets.ts`), das feste Dark-Cyan-Design im Dashboard selbst berücksichtigt diese Wahl aber gar nicht mehr — Auswahl ohne Wirkung. Entweder Step entfernen oder als reine Akzentfarbe im festen Dark-Theme wieder einbauen.
11. Supabase-Projekt pausiert bei Inaktivität (Free-Tier) — vor einem Kundentermin/Demo prüfen, ob das Projekt noch aktiv ist bzw. auf einen bezahlten Plan wechseln, sonst sind bei einem Neustart alle Tabellen leer.

## E. Tests/QA

12. Vollständiger End-to-End-Test: Registrierung → Onboarding → Startseite → Lieferschein → Artikel-Erkennung → Tourenplanung — laut Tagesplan für Freitag vorgesehen, Stand unklar. Der Fahrerpfad (Login → eigene Tour → Stop abschließen → Reload) ist am 22.08.2026 automatisiert (`npm run test:integration`) und im Browser geprüft.
13. RLS für `artikel`/`packmittel` unter echter Fahreridentität geprüft: Lesen der eigenen Company ja, Schreiben nein; fremde Companies unsichtbar. Zusätzlich geschlossen: Mandantenleck in `email_log` ohne `company_id`, Fahrer-Schreibrechte auf Depot/Tourenplan/Firma/Integrationen, `TRUNCATE` für `anon`/`authenticated`.
14. Automatisierte Tests: 25 Unit-Tests plus 9 Integrationstests für den Fahrer-Login und Stop-Abschluss. Playwright bleibt ungenutzt; der kritische Fahrerpfad läuft über Vitest gegen die Remote-DB.

## F. Versionsstand

15. Samstag 22.08.2026: Fahrerbetrieb ohne Demo-Daten (Tour, Stop-Abschluss, ehrliche Karte, RLS, Fahrerfotos). Branch `feat/samstag-fahrerbetrieb`. Offene Restpunkte: echtes Live-GPS, Passwort-Rotation, IMAP-Import.

## G. Außerhalb meines Blickfelds — bitte selbst einordnen

Ich sehe nur Code und Datenbank, keine geschäftliche/rechtliche Seite. Für „Verkauf" typischerweise zusätzlich nötig: Impressum/AGB/Datenschutzerklärung, Auftragsverarbeitungsvertrag (AVV) mit Kunden (personenbezogene Fahrer-/Kundendaten!), Preismodell/Abrechnung, Support-Prozess, Datenmigration für echte Bestandskunden, Produktions-Hosting-Plan (Supabase-Tier, Domain, Backups/Monitoring). Kann ich bei Bedarf mit recherchieren, sobald klar ist, was davon schon existiert.
