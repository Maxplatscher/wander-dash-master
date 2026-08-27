# DispoCenter

Disposition für Lieferscheine, Touren und Fahrer. Kein Lovable-Template mehr — der operative Kern
läuft gegen Supabase (`sxqbmxqnwtrgibfryvqf`).

## Was die App kann

- Disponent: Login (keine öffentliche Registrierung), Onboarding, manuelle Sendungen, IMAP- und CSV-Eingang, Geokodierung, `plan-tour` mit Gewicht **und** Volumen, wenn L/B/H am Fahrzeug stehen.
- Fahrer: Login per Einladung, „Meine Tour“, Stops abschließen. GPS-Consent auf dem Gerät; keine Live-Ortung an die Disposition.
- Integrationen: IMAP (manuell + geplanter Abruf), CSV-Upload, SFTP-CSV wenn Credentials da sind. UNC-Freigaben bleiben manuell.

## Starten

```bash
npm install
cp .env.example .env   # Supabase-URL, Anon-Key, optional Maps
npm run dev            # Vite auf http://localhost:8080
```

## Tests

```bash
npm test               # Vitest Unit
npm run test:integration
npm run test:e2e       # Playwright, Credentials in gitignorierter .env.test
```

## Edge Functions

Unter `supabase/functions/`. Deploy nur nach Freigabe auf das Projekt `sxqbmxqnwtrgibfryvqf`.
`fetch-imap` hat `verify_jwt = false` und erwartet für den Cron `IMAP_CRON_SECRET`.

## Dokumentation

- `docs/CHECKLISTE_TESTKUNDE.md` — was ein Testkunde brauchen sollte
- `docs/CHECKLISTE_VOR_VERKAUF.md` — Rest vor Verkauf
- `docs/NOMINATIM_LIMITS.md`, `docs/ZEITFENSTER_UTC.md`, `docs/KARTE_STANDORTQUELLE.md`
- Rechtstexte unter `/impressum` und `/datenschutz` sind **Entwürfe**

Design (Hell-Modus, Akzent, Layout), anwaltliche Texte, Supabase Pro und GPS auf dem Handy bleiben bewusst außerhalb des Codes.
