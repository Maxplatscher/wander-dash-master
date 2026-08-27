# Checkliste vor Verkauf/Launch — DispoCenter

> Stand: 27.08.2026, nach Technik B+A (Invite, Volumen, IMAP, CSV/SFTP, Playwright, ehrliche UI).
> `docs/CLAUDE_PROJECT_PROMPT.md` ist an mehreren Stellen veraltet. Für den Testkunden:
> `docs/CHECKLISTE_TESTKUNDE.md`.

## A. Kern — im Code erledigt, Deploy/Betrieb oft noch offen

1. **Karte** — keine GPS-Quelle. Marker nur aus geokodierten `shipment.location_x`/`location_y`. Vor Planung läuft `geocode-shipments` (Google, sonst Nominatim). Limits: `docs/NOMINATIM_LIMITS.md`. Live-GPS und Historie fehlen bewusst.
2. **Meine Tour** — Fahrer über `users.driver_id`, Stops über `complete_my_tour_stop`. Invite legt den Login an (`invite-driver`). GPS-Consent auf Meine Tour, keine Übertragung.
3. **IMAP** — Parser setzt Adresse/Name/Gewicht nur wenn gefunden. Manueller Abruf plus geplanter Cron (`fetch-imap`, Secret). Deploy + `IMAP_CRON_SECRET` sind Betreiber-Schritte.
4. **CSV/SFTP** — Upload unter Integrationen, `fetch-sftp` für HTTPS/SFTP-CSV. UNC bleibt manuell.

## B. Sicherheit (Betreiber)

5. Leaked-Password-Protection in Supabase Auth vor Live aktivieren. Testpasswörter aus Git-Verlauf rotieren.
6. Google-Maps-Key: HTTP-Referrer auf Produktionsdomain setzen.
7. Functions nach Freigabe deployen: `invite-driver`, `fetch-imap`, `fetch-sftp`, `geocode-shipments`, `plan-tour`. Migration Fahrzeug-L/B/H remote anwenden.

## C. Planung

8. `plan-tour` prüft Rest-kg und Rest-m³, wenn L/B/H am Fahrzeug stehen. Kein 3D-Bin-Packing.
9. Artikel-KI (`research-article`) unverändert: quelllose Schätzungen werden abgelehnt.

## D. Infrastruktur

10. Kein Storage-Bucket — Fahrer-Foto kann nicht hochgeladen werden.
11. Farbschema/Hell-Modus ist Design-Arbeit, nicht Teil dieser Runde.
12. Supabase Free-Tier pausiert — vor Kundentermin prüfen oder Pro buchen.

## E. Tests

13. Unit: Vitest inkl. Invite, Volumen, IMAP-Parser, CSV, Suche, formatTime, Demo-Zugang.
14. Integration: `npm run test:integration` (Fahrer-Login/Stop).
15. E2E: `npm run test:e2e` (Playwright, `.env.test`). Registrierungs-Wizard nicht im E2E, Invite deckt den Fahrerpfad.

## F. Recht / Verkauf — nicht im Code final

16. `/impressum` und `/datenschutz` sind Entwürfe mit Banner. AVV fehlt.
17. Preismodell, Support, Monitoring, Telematik: außerhalb.

## G. Totcode

18. Ungeroutete Lovable-Reste entfernt: `Index`, `AppSidebar`, `NavLink`, `StatCard`, `TourCard`, `DispatchSidebar`, `SetupConsent`, `ConsentDialog`. Consent sitzt im Onboarding (`StepPermissions`) und in den Einstellungen.
