# Tagesplan Samstag, 22.08.2026 — Verkaufsblocker Fahrerbetrieb

> Stand nach Restzeit: Fahrertour, Stop-Abschluss, ehrliche Karte, RLS, Fahrerfotos und Adress-Geokodierung (`geocode-shipments`) sind umgesetzt. Folgearbeit: Google-Server-Key ohne HTTP-Referrer (`GOOGLE_MAPS_API_KEY`, Checkliste Punkt 5), echtes Live-GPS, Passwort-Rotation.

## Tagesziel

Am Ende des Tages darf der Fahrerbetrieb keine Demo-Daten mehr vortäuschen:

- Fahrer sehen ihre echte Tour und echte Stops aus Supabase.
- Stop-Abschlüsse werden dauerhaft in `tour_stop` gespeichert.
- Die Startseiten-Karte zeigt ausschließlich echte, nachvollziehbare Daten — oder einen ehrlichen Leerzustand.
- Kritische Datenbankrechte und RLS-Regeln sind geprüft.
- Der vollständige Fahrerpfad ist getestet, dokumentiert und in kleinen Commits gesichert.

Wichtiger als neue Tourenplanungslogik: `DriverTourView.tsx` und `LiveMap.tsx` sind laut Verkaufscheckliste (`docs/CHECKLISTE_VOR_VERKAUF.md`, Punkt A.1/A.2) aktuell direkte Produktblocker.

## Definition of Done

1. Ein eingeloggter Fahrer kann ausschließlich seine eigene aktive Tour des gewählten Tages laden.
2. Tour, Fahrzeug, Stops, Adressen, Gewichte und Zeitfenster kommen aus der Datenbank.
3. „Stop erledigt" bleibt nach einem Reload weiterhin erledigt.
4. Keine hartcodierten Fahrer, Stops, Berliner Koordinaten oder Demo-Marker erscheinen mehr als echte Live-Daten.
5. Fehler-, Lade- und Leerzustände sind verständlich dargestellt.
6. Die relevanten RLS- und Funktionsrechte erlauben keinen mandantenübergreifenden Zugriff.
7. Build, Lint und mindestens ein automatisierter Test des kritischen Pfads laufen erfolgreich.
8. Alle Änderungen sind committed und gepusht.

## Kernplan — 6 Stunden

**Block 0 — Sicher starten (0:00–0:30)**
GitHub-Desktop-Push der zwei aktuell lokalen Commits kontrollieren. Arbeitsbaum auf sauberem Stand prüfen. Eigene Feature-Branch für den Samstag anlegen. Supabase-Projektstatus, Testbenutzer und vorhandene Testtour prüfen. Vor Änderungen festhalten, wie Auth-User und `driver` aktuell verknüpft sind.
Abnahmepunkt: reproduzierbarer Testfahrer mit zugeordneter Tour.

**Block 1 — `DriverTourView` vollständig auf echte Daten umstellen (0:30–3:00)**
Hardcodierte Berliner Demo-Stops und lokalen Erledigt-State entfernen. Fahreridentität sauber aus Auth/DB ableiten — kein Matching über Anzeigename. Aktive Tour, Fahrzeug und `tour_stop` für den aktuellen Tag laden. Zugehörige `shipment`-Daten für Kunde, Adresse, Gewicht und Zeitfenster ergänzen. Stop-Abschluss über `driver_completed` und `driver_completed_at` persistieren. Queries nach Abschluss invalidieren und Fortschritt neu berechnen. Lade-, Fehler-, „keine Tour"- und „Tour vollständig"-Zustände ergänzen. Mandanten- und Fahrerzugriff über RLS bzw. serverseitige Prüfung absichern.
Abnahmepunkt: Ein Stop kann abgeschlossen werden und bleibt nach Reload abgeschlossen.

**Wichtige Entscheidung:** Auth-User → Fahrer läuft bereits über `public.users.driver_id` (existiert im Schema, FK auf `driver.id`) — wird aber im Code aktuell nirgends gelesen. Keine Migration nötig, nur Anbindung im Code. Keine provisorische E-Mail-/Namensheuristik verwenden.

**Block 2 — `LiveMap` ehrlich und datenbasiert machen (3:00–4:15)**
`driverMarkers` und alle fest codierten Demo-Positionen entfernen. Nur Marker aus real vorhandenen Koordinaten oder einer klar definierten Standortquelle anzeigen. Falls noch keine GPS-Quelle existiert: keine Position erfinden; Karte als Tour-/Stop-Lage statt „Live-Standort" kennzeichnen; Fahrer ohne Koordinaten in einer erklärenden Liste anzeigen; klaren Leerzustand darstellen. Festlegen und dokumentieren, welche spätere Quelle echtes Live-GPS liefern soll.
Abnahmepunkt: Kein Nutzer kann Demo-Marker mit echten Fahrerpositionen verwechseln.

**Block 3 — Sicherheitsprüfung Fahrerpfad und Stammdaten (4:15–5:15)**
RLS für `driver`, `tour`, `tour_stop`, `shipment`, `artikel` und `packmittel` gezielt testen. Prüfen, ob ein Fahrer fremde Touren oder andere Companies lesen/ändern kann. `function_search_path_mutable` für `set_updated_at` beheben. Rechte besonders sensibler `SECURITY DEFINER`-Funktionen prüfen und unnötige Grants entziehen. Änderungen als eigene Migration schreiben und Security Advisor erneut ausführen.
Abnahmepunkt: keine neue kritische Warnung, kein nachgewiesener Mandantenübergriff.

**Block 4 — Tests und Abschluss (5:15–6:00)**
Automatisierten Test für Tourladen und Stop-Abschluss ergänzen. Browser-E2E: Fahrer-Login → eigene Tour → Stop abschließen → Reload. Dispatcher-E2E: Startseite zeigt aktualisierten Fortschritt. Build, ESLint und Diff-Check ausführen. Kurze Dokumentation aktualisieren. Kleine, fachlich getrennte Commits erstellen und pushen.

## Erweiterung — zusätzliche 1–2 Stunden

Nur beginnen, wenn alle Abnahmepunkte des Kernplans erfüllt sind.

**Fahrerfoto-Infrastruktur fertigstellen (6:00–7:15)**
Privaten Supabase-Storage-Bucket für Fahrerfotos anlegen. Dateityp und Größe begrenzen. RLS: Lesen innerhalb der Company, Schreiben nur berechtigt. Upload im Fahrer-Dialog anbinden und `photo_url` speichern. Upload, Austausch und fehlendes Foto testen.

**Restzeit und Stabilisierung (7:15–8:00)**
Browserprüfung auf Desktop und schmaler Ansicht. Fehlertexte und Ladezustände nachziehen. Verkaufscheckliste (`docs/CHECKLISTE_VOR_VERKAUF.md`) auf den tatsächlichen Stand bringen. Abschließenden Push und sauberen Git-Status prüfen.

## Bewusst nicht am Samstag

Vollständiger IMAP-/E-Mail-Import; Volumen-/3D-Packing in `plan-tour`; Theme-Picker-Neukonzeption; Produktionsdomain und finale Google-Referrer; rechtliche und geschäftliche Verkaufsthemen.

## Stop-Regeln

Keine Mock-Daten als Fallback auf produktiven Seiten. Keine Zuordnung von Benutzern über Namen oder zufällige Reihenfolgen. Keine neue Tabelle oder Migration ohne RLS. Kein „Live"-Label ohne echte Standortquelle. Nach jedem Kernblock kurz im Browser prüfen und einen kleinen Commit erstellen. Bei mehr als 30 Minuten Blockade Ursache dokumentieren, Entscheidung mit Max treffen und nicht mit einer unsicheren Abkürzung weiterbauen.

## Entscheidungen von Max (geklärt am 20.08.2026)

1. Eigener Supabase-Login pro Fahrer, Zuordnung über bestehendes `public.users.driver_id`.
2. Karte bis zur echten GPS-Quelle als „Tourposition / letzter bestätigter Stop" beschriftet, nicht als „Live-Standort".
3. Noch kein Testaccount vorhanden — Max legt vor bzw. zu Beginn von Block 0 einen echten Fahrer-Testaccount mit Tour und ≥3 Stops an (z. B. über `demo-setup`/`create-admin` oder manuell über Kontrollzentrale).
