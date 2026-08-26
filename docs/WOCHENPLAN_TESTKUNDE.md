# Wochenplan — Projekt fertig für ersten Testkunden

Ziel: Ende dieser Woche sind alle „Muss"-Punkte der Checkliste erledigt. Nächste Woche bleibt als Puffer + Testkunden-Vorbereitung.

Quelle: `docs/CHECKLISTE_TESTKUNDE.md`. Stand des Plans: 24.08.2026.

---

## Entscheidungen (Montag Block 2)

- **Intake:** E-Mail-Postfach (IMAP), manuell in der Kontrollzentrale. Verkäuferordner legt der Kunde selbst an und verbindet ihn später unter Einstellungen. Kein NAS-Watch.
- **Hosting:** Cloudflare Pages (Domain-Transfer läuft bereits zu Cloudflare, 5–7 Tage). Bis die Domain live ist: Standard-Subdomain von Pages (`*.pages.dev`) mit HTTPS.
- **Zieldomain:** `https://dispocenter.com` — DNS und Maps-Referrer `https://dispocenter.com/*` erst nach abgeschlossenem Transfer.
- **Nameserver (24.08. Abend):** Umstellung eingeleitet, Zonen-Badge noch `free`, Check läuft Stunden. Nicht darauf warten. Morgen oder in ein paar Stunden erneut prüfen, ob der Transfer-Schritt mit Auth-Code frei ist.

---

## Montag — Sicherheit + Entscheidungen

**Block 1 (Vormittag) — Sicherheit**

- Testpasswort rotieren (Auth-Passwort in Supabase ändern, alle Sessions kicken)
- Neues Passwort nur in gitignorierter `.env.test`
- Leaked-Password-Protection in Supabase Auth einschalten
- `get_my_role()`: `ORDER BY role ASC` (Enum: admin, dispatcher, driver)
- Prüfen: Testfahrer hat nicht zusätzlich `dispatcher` in `user_roles`
- Zwei Browserprofile dokumentieren (Disposition / Fahrer)

**Block 2 + 3** — Intake und Hosting wie oben. Pages-Projekt anbinden, Preview-Deploy.

Abnahme: Passwort rotiert ✅, Entscheidungen dokumentiert ✅, Nameserver-Umstellung läuft ✅, Pages-Preview `https://dispocenter.pages.dev` ✅. Offen: HIBP-Toggle (Plan prüfen, nicht automatisch upgraden).

---

## Dienstag — Hosting fertig + Keys

Stand 25.08., nach Prompt `docs/PROMPT_DIENSTAG_HOSTING_KEYS.md`:

- [x] Env im Pages-Projekt (seit Montag): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GOOGLE_MAPS_API_KEY` — nicht ANON_KEY. Bundle auf `https://dispocenter.pages.dev` zeigt auf Projekt `sxqbmxqnwtrgibfryvqf`.
- [x] App unter HTTPS: Login `https://dispocenter.pages.dev/auth` lädt.
- [x] Domain heute **nicht** anfassen. Registrar-Transfer steht auf „Ready for transfer“ (Schritt 1/3, noch nicht gestartet). Referrer und DNS bleiben auf `*.pages.dev`. Nameserver sind bereits Cloudflare, Zone ohne A/MX — trotzdem kein Pages-Alias, bis der Transfer durch ist.
- [x] Frontend-Key auf „Websites“ eingeschränkt: `http://localhost:8080/*`, `http://127.0.0.1:8080/*`, `https://dispocenter.pages.dev/*`. `dispocenter.com` unangetastet. Preview-Hosts außerhalb dieser Liste brechen jetzt ab.
- [x] Eigenen Google-Server-Key als Edge Secret `GOOGLE_MAPS_API_KEY` gesetzt (nicht der Vite-Key). Direktes Geocoding ohne HTTP-Referrer: `status = OK`.
- [x] `geocode-shipments` antwortet `provider = google` (Secret greift). Für den 25.08. keine Sendungen zum Aktualisieren (`scanned = 0`). Sobald eine Adresse da ist, in der Kontrollzentrale nochmal klicken.
- [x] Supabase-Organisation ist **Free**. Pause-Risiko vor Kundentermin bleibt — Upgrade nur nach bewusster Entscheidung, kein Auto-Upgrade. Projekt aktuell `ACTIVE_HEALTHY`.

Abnahme: App unter HTTPS erreichbar (Pages-Subdomain reicht vorerst), Geokodierung läuft über Google statt Fallback.

---

## Mittwoch — Dispatcher-Pfad komplett

- Mandant anlegen/Onboarding → Depot mit Koordinaten → Sendung mit Adresse → Geokodieren → Planung starten → Fahrer sieht Tour → Stop abschließen → Startseite zeigt Fortschritt + GPS
- Alle dabei gefundenen Bugs sofort fixen, nicht sammeln
- Kleine Commits währenddessen

Abnahme: Ein Dispatcher kann von Null (neue Sendung) bis Tourabschluss alles ohne Klemmpunkt durchklicken.

---

## Donnerstag — Onboarding-Ehrlichkeit

- IMAP-Basisabruf ist gebaut (Kontrollzentrale „Mails abrufen"). Wizard-Text zum Lieferschein-Ordner an den echten Stand anpassen, nichts versprechen was fehlt.
- `onboarding_completed_at` von pro-User auf pro-Firma umstellen
- Onboarding-Schritt „Design"/`StepTheme` entweder anbinden oder entfernen
- `demo-setup` in der Kontrollzentrale für Kundenmandanten verstecken/als „nur intern" markieren
- Fahrer-Consent: Standortfreigabe-Text in „Meine Tour" prüfen, nicht im Onboarding versprechen

Abnahme: Onboarding verspricht nichts, was die App nicht kann.

---

## Freitag — GPS auf echtem Gerät + Recht anstoßen

- Fahrer-GPS auf echtem Handy testen (HTTPS zwingend, außer localhost)
- Nominatim-Nutzungsgrenzen dokumentieren, solange Google-Key noch nicht überall greift
- Zeitfenster-Doku (UTC in DB vs. CEST-Anzeige) kurz schriftlich festhalten
- Rechtliches anstoßen (parallel, kein Code): Datenschutzerklärung-Entwurf (Fahrer-GPS, Sendungsadressen, Fotos), AVV/Pilotvereinbarung, Impressum sobald Domain live

Abnahme: GPS funktioniert auf einem echten Smartphone. Rechtstexte sind mindestens in Arbeit.

---

## Samstag — Stabilisierung + Vollabnahme

- Alle offenen Bugs aus der Woche abarbeiten
- Build, Lint, Tests komplett grün
- Verwaiste Alt-Komponenten nur falls Zeit übrig (kein Muss)
- Verkaufscheckliste (`docs/CHECKLISTE_VOR_VERKAUF.md`) gegen echten Stand abgleichen
- Kompletten Kern-Flow (Dispatcher + Fahrer) ein letztes Mal auf der Zieldomain/Host testen

Abnahme: Alle „Muss vor Testkunde"-Punkte der Checkliste sind abgehakt.

---

## Sonntag — Puffer

Kein neuer Code. Nur falls Freitag/Samstag etwas gerissen ist, hier auffangen. Sonst frei.

---

## Nächste Woche (Kurzfassung)

- Domain-Transfer sollte durchgelaufen sein → finale DNS-Umstellung, Referrer final
- Testkunden-Onboarding vorbereiten: Zugang, kurze Einweisung, Support-Kontaktweg
- Rechtstexte final abstimmen und veröffentlichen
- Reserve für unerwartete Findings aus der Woche 1
