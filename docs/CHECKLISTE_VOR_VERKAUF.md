# Checkliste vor Verkauf/Launch — DispoCenter

> Stand: 19.08.2026, direkt im Code/DB geprüft (nicht nur aus alten Docs übernommen). `docs/CLAUDE_PROJECT_PROMPT.md` ist an mehreren Stellen veraltet — z. B. sind die dort gelisteten Alt-Komponenten und `Versionen.tsx` bereits entfernt, `Fahrer.tsx`/`Kalender.tsx` laufen bereits auf echten Daten. Diese Liste ersetzt den technischen Teil davon.

## A. Kernfunktionen, die noch nicht echt sind (Blocker)

1. **Live-Standortkarte (`LiveMap.tsx`)** — zeigt weiterhin 4 fest einprogrammierte Fahrer-Marker (`driverMarkers`), keine echten GPS-/Standortdaten. Das ist das Herzstück der Startseite („Live-Lage") — ohne echte Standortquelle (Fahrer-App mit Standortfreigabe, oder zumindest Stop-Check-in-Zeitpunkt als Näherung) zeigt die Karte im Verkaufsfall falsche Informationen an.
2. **„Meine Tour heute" für Fahrer-Rolle (`DriverTourView.tsx`)** — komplett hardcodierte Demo-Stops in Berlin, Haken-Status nur lokal im Browser-State, nichts wird in `tour_stop` gespeichert. Ein echter Fahrer, der sich einloggt, sieht nicht seine eigene Tour. Muss auf echte `tour_stop`-Daten des eingeloggten Fahrers umgestellt werden.
3. **E-Mail/IMAP-Import für Lieferscheine** — in `Kontrollzentrale.tsx` nach wie vor nur ein Platzhalter („Ausstehend", feste Beispiel-Adresse `lieferscheine@dispatch.example.com`). Keine echte IMAP-Anbindung, kein automatisches Anlegen von `shipment`-Zeilen aus Mails. Das ist aber genau die Berechtigung, die im Onboarding-Wizard bereits abgefragt wird („Zugriff auf Lieferscheine erlauben") — Erwartung vs. Funktion klaffen auseinander.

## B. Sicherheit

4. Verbliebene Supabase-Security-Advisor-Warnungen (aktuell geprüft, keine neuen seit dem `companies`-Fix): `function_search_path_mutable` auf `set_updated_at`; mehrere `SECURITY DEFINER`-Funktionen von `anon`/`authenticated` aufrufbar (`decrypt_integration_secret`, `encrypt_integration_secret`, `ensure_default_company`, `get_my_role`, `get_user_company_id`, `handle_new_user`, `has_role`, neu dazugekommen: `delete_integration_with_secret`) — einzeln durchgehen, ob das gewollt ist oder `search_path`/Rechte enger gefasst werden sollten. „Leaked Password Protection" ist in Supabase Auth deaktiviert — vor Live-Betrieb aktivieren.
5. Google Cloud: HTTP-Referrer-Einschränkung für den Maps-Key gilt bisher nur für `localhost`/LAN-IP — sobald eine Produktionsdomain feststeht, dort ergänzen (sonst blockt Places/Maps live).

## C. Tourenplanung/KI — Tiefe fehlt noch

6. `plan-tour` rechnet weiterhin nur 1-dimensional mit Gewicht (`weight_kg`/`demand`) und einer Manhattan-Distanz-Heuristik — keine Volumen-/Packmittel-Logik, obwohl `artikel`/`packmittel`-Tabellen bereits existieren. Die Verknüpfung „Artikelmaße → Ladevolumen → Tourenplanung" ist konzeptionell offen (war als Donnerstag-Punkt vorgesehen).
7. `vehicle`-Tabelle hat noch keine Laderaum-Maße (Länge/Breite/Höhe) — Voraussetzung für Punkt 6.
8. Artikel-KI-Recherche (`research-article`/`ArticleReviewPanel`) ist end-to-end getestet. Offen bleibt ein verfügbares Websuchkontingent: Gemini Google Search liefert im aktuellen Projekt HTTP 429; alternativ `SERPER_API_KEY` oder `TAVILY_API_KEY` setzen. Quelllose Schätzungen werden inzwischen bewusst abgelehnt.

## D. Fehlende Infrastruktur

9. Kein Storage-Bucket in Supabase vorhanden — die Fahrer-Visitenkarte hat ein `photo_url`-Feld, aber ohne Bucket kann kein Foto hochgeladen werden.
10. Onboarding-Wizard fragt weiterhin ein Farbschema ab (`StepTheme.tsx`, `theme-presets.ts`), das feste Dark-Cyan-Design im Dashboard selbst berücksichtigt diese Wahl aber gar nicht mehr — Auswahl ohne Wirkung. Entweder Step entfernen oder als reine Akzentfarbe im festen Dark-Theme wieder einbauen.
11. Supabase-Projekt pausiert bei Inaktivität (Free-Tier) — vor einem Kundentermin/Demo prüfen, ob das Projekt noch aktiv ist bzw. auf einen bezahlten Plan wechseln, sonst sind bei einem Neustart alle Tabellen leer.

## E. Tests/QA

12. Vollständiger End-to-End-Test: Registrierung → Onboarding → Startseite → Lieferschein → Artikel-Erkennung → Tourenplanung — laut Tagesplan für Freitag vorgesehen, Stand unklar.
13. RLS-Review der neueren Tabellen `artikel`/`packmittel` (Muster sieht korrekt aus, aber noch nicht gezielt gegengeprüft — vergleichbare Policy-Bugs haben diese Woche zweimal den Betrieb blockiert).
14. Automatisierte Tests (Vitest/Playwright) sind im Projekt eingerichtet, aber laut letztem Stand nur mit einem Beispieltest — für ein Verkaufsprodukt sollte zumindest der kritische Pfad (Login → Tourenplanung) abgedeckt sein.

## F. Versionsstand

15. Shell-Chrome, Fahrer-Seite, Probleme-Labels, Schema-Angleichung `system_integrations` und die abgesicherte Artikelrecherche gehören zu diesem gemeinsamen Versionsstand. Nach dem Commit noch den Push-Status prüfen.

## G. Außerhalb meines Blickfelds — bitte selbst einordnen

Ich sehe nur Code und Datenbank, keine geschäftliche/rechtliche Seite. Für „Verkauf" typischerweise zusätzlich nötig: Impressum/AGB/Datenschutzerklärung, Auftragsverarbeitungsvertrag (AVV) mit Kunden (personenbezogene Fahrer-/Kundendaten!), Preismodell/Abrechnung, Support-Prozess, Datenmigration für echte Bestandskunden, Produktions-Hosting-Plan (Supabase-Tier, Domain, Backups/Monitoring). Kann ich bei Bedarf mit recherchieren, sobald klar ist, was davon schon existiert.
