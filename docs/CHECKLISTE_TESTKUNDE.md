# Checkliste Testkunde

Stand: 27.08.2026. Ziel: Ein Testkunde kann die App **benutzen**, ohne auf tote Kern-Buttons zu stoßen.
Design, anwaltliche Texte und Handy-GPS bleiben beim Betreiber.

## Zugang

- [x] Login für Disponent (öffentliche Registrierung aus)
- [x] Fahrer-Login per Invite (`invite-driver`, E-Mail im Fahrer-Dialog)
- [ ] Ersten Fahrer-Account in der Zielumgebung anlegen und Passwort notieren
- [ ] Edge Function `invite-driver` auf `sxqbmxqnwtrgibfryvqf` deployen

## Disposition

- [x] Manuelle Sendung / CSV-Upload / IMAP-Abruf (Adresse nur wenn Parser sie findet)
- [x] Geokodierung vor `plan-tour` (Kontrollzentrale und Kalender)
- [x] Planung mit kg; m³ zusätzlich wenn Fahrzeug L/B/H gesetzt
- [x] Demo-Szenario nur bei internen Mandanten „Demo A/B/…“
- [x] Suche über Sendung, Fahrer, Adresse; keine Attrappen-Glocke
- [ ] `geocode-shipments`, `plan-tour`, `fetch-imap`, `fetch-sftp` in der Zielumgebung deployen
- [ ] IMAP-Cron / Secret `IMAP_CRON_SECRET` setzen, wenn Dauerabruf gewünscht
- [ ] Migration `vehicle.length_mm/width_mm/height_mm` remote anwenden

## Fahrer

- [x] Meine Tour aus `users.driver_id` → `tour.driver_id`
- [x] Stop-Abschluss über RPC
- [x] GPS-Consent auf Meine Tour (keine Live-Übertragung)
- [ ] Auf echtem Handy / PWA prüfen (Betreiber)

## Ehrlichkeit

- [x] Probleme „Übernehmen“ / „Zuweisen“ schreiben in die DB oder der Toast lügt nicht
- [x] UNC bleibt manuell; CSV/SFTP sind die automatischen Ordnerwege
- [x] Impressum/Datenschutz als Entwurf mit Banner, Links auf Auth

## Nicht in dieser Runde (Betreiber)

- Hell-Modus / Akzent / Layout
- Supabase Pro, Leaked-Password-Protection
- Recht final + AVV
- Telematik, GPS-Historie, Preismodell, Monitoring
- 3D-Stauraum
