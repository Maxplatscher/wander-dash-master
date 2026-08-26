# Checkliste bis zum ersten Testkunden

Stand: 24.08.2026. Quelle: aktueller Code auf `feat/samstag-fahrerbetrieb`, `docs/CHECKLISTE_VOR_VERKAUF.md` und der Samstagsarbeit. Das **Fahrer-Tagesziel** (echte Tour, persistenter Stop, ehrliche Karte, RLS, GPS mit Alter) ist erledigt. Diese Liste sind die offenen Punkte **bis ein erster externer Testkunde** DispoCenter nutzen kann.

Erledigt-Markierung: `- [ ]` offen, nicht „schon fast“.

---

## 0. Entscheidung vor dem Bauen

- [x] **Intake-Weg des Testkunden:** Zuerst **E-Mail-Postfach (IMAP)**. Den gemeinsamen Verkäuferordner legt der Kunde selbst an und verbindet ihn später unter **Einstellungen** (`csv_import` / SFTP). Kein NAS-Watch vom Laptop.
- [x] **Wo läuft der Pilot?** Cloudflare Pages, bis der Registrar-Transfer durch ist über `*.pages.dev`. Zieldomain `https://dispocenter.com`. Nameserver zeigen schon auf Cloudflare; Transfer-UI steht auf „Ready for transfer“ (Schritt 1/3) — DNS/Referrer erst nach Abschluss auf die Apex-Domain.

---

## 1. Muss vor dem ersten Testkunden — sonst bricht der Pilot oder die Sicherheit

### Sicherheit und Zugänge

- [x] **Testpasswort rotieren.** Auth-Passwort in Supabase geändert, Sessions gekickt. Neue Werte nur in gitignorierter `.env.test` (`E2E_DRIVER_PASSWORD`, `E2E_DISPATCHER_PASSWORD`). Das alte Passwort aus Commit `0df1dfd` gilt nicht mehr.
- [ ] **Leaked-Password-Protection** in Supabase Auth einschalten (Advisor-WARN). Nur Pro-Plan; Toggle unter [Auth → Providers → Email](https://supabase.com/dashboard/project/sxqbmxqnwtrgibfryvqf/auth/providers?provider=Email). CLI-Access-Token lag nicht als Datei vor, daher nicht automatisch gesetzt.
- [x] **Kein gemeinsames Tab-Login.** Eine Auth-Session gilt für alle Tabs derselben Origin. Für den Piloten: zwei Browserprofile (Disposition / Fahrer), siehe `docs/PILOT_BROWSERPROFILE.md`.
- [x] **Eine Rolle pro User.** `get_my_role()` sortiert `ORDER BY role ASC` (admin, dispatcher, driver). Testfahrer hat nur `driver`, Dispatcher nur `dispatcher`.

### Hosting, Keys, Betrieb

- [x] **Eigenen Google-Server-Key** als Edge Secret `GOOGLE_MAPS_API_KEY` (nicht der Vite-Key). Direktes Geocoding ohne HTTP-Referrer `OK`; `geocode-shipments` liefert `provider = google`. Am 25.08. keine Sendungen zum Aktualisieren (`scanned = 0`) — nächste Adresse in der Kontrollzentrale nochmal klicken.
- [x] **Frontend-Key-Referrer.** Maps-Key auf „Websites“: `http://localhost:8080/*`, `http://127.0.0.1:8080/*`, `https://dispocenter.pages.dev/*`. `https://dispocenter.com/*` erst nach Registrar-Transfer. Andere Hosts (z. B. `*.dispocenter.pages.dev` Preview) sind jetzt blockiert.
- [ ] **Supabase nicht auf Free-Tier-Pause** lassen. Org ist **Free** (25.08.). Vor dem Kundentermin Upgrade auf Pro entscheiden oder Projekt manuell wachhalten. Pause leert nicht die Tabellen, stoppt aber Auth/API mitten in der Demo. Kein Auto-Upgrade.
- [x] **App erreichbar machen:** Cloudflare Pages Production `https://dispocenter.pages.dev` (Deploy 1559e884, HTTPS). Env im Pages-Projekt: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (nicht ANON_KEY), `VITE_GOOGLE_MAPS_API_KEY`. Kein Alias auf dispocenter.com.

### Produkt, das der Kunde am ersten Tag braucht

- [ ] **Dispatcher-Pfad einmal echt durchspielen** (nicht nur Fahrer-Login): Registrierung oder angelegter Mandant → Onboarding → Depot mit Koordinaten → Sendung mit Adresse → Geokodieren → Planung starten → Fahrer sieht Tour → Stop abschließen → Startseite zeigt Fortschritt und ggf. GPS.
- [ ] **Fahrer-GPS auf dem Handy** prüfen (HTTPS nötig für Geolocation außer localhost). Button „Standort teilen“ in Meine Tour; Dispatcher sieht Badge mit Alter, kein „Live-Standort“.
- [ ] **Wetter/Depot:** gewähltes Depot braucht `lat`/`lng`, sonst bleibt Wetter ehrlich leer (kein München-Fake mehr).
- [x] **IMAP-Abruf (manuell).** Unter Einstellungen IMAP hinterlegen, Verbindung testen, in der Kontrollzentrale „Mails abrufen“. Ungelesene Mails werden zu `shipment` + `email_log` (ohne erfundene Adresse). Kein Dauerabruf, kein Verkäuferordner-Import.

### Recht / Pilotvertrag (kein Code, aber Pflicht vor fremden Daten)

- [ ] Datenschutzerklärung (Fahrer-GPS, Sendungsadressen, Fotos).
- [ ] AVV bzw. Pilotvereinbarung, wenn der Kunde personenbezogene Daten einspielt.
- [ ] Impressum, sobald die App unter einer Domain öffentlich erreichbar ist.

---

## 2. Sollte der Testkunde nicht als kaputt oder unehrlich erleben

- [ ] **Onboarding-Schritt Design entfernen oder anbinden.** `StepTheme` speichert ein Farbschema, das Dashboard bleibt Dark-Cyan. Auswahl ohne Wirkung.
- [ ] **`demo-setup` in der Kontrollzentrale** für den Kundenmandanten verstecken oder klar als „nur intern“ markieren — sonst landet Münchner Demo-Zeug in echten Daten.
- [ ] **Onboarding `onboarding_completed_at` ist pro User**, der Wizard schreibt aber firmweite Stammdaten. Zweiter Dispatcher derselben Firma läuft wieder durch `/setup`.
- [ ] **Fahrer-Consent:** Fahrer überspringen den Firmen-Wizard. Standortfreigabe passiert erst in Meine Tour — so lassen oder in der Fahreransicht erklären, nicht im Onboarding versprechen.
- [ ] **Windows in der UI vs. UTC in der DB** dokumentieren (Anzeige in CEST ist kein Stammdatenfehler).
- [x] **Nominatim-Nutzungsgrenzen.** Google-Server-Key ist gesetzt; Nominatim bleibt nur Fallback. Trotzdem kein Massen-Geocode in einer Kundendemo.

---

## 3. Darf nach dem ersten Piloten kommen (kein Blocker für „erste echte Tour“)

- [ ] IMAP-Dauerabruf (Cron) und Adressen aus der Mail parsen statt nur Review-Sendungen.
- [ ] Verkäuferordner: Kunde legt den Ordner selbst an, Verbindung unter Einstellungen, dann Import (`csv_import` / SFTP) — bewusst nach IMAP.
- [ ] `vehicle` um Laderaum (L/B/H) erweitern, danach Volumen/`packmittel` in `plan-tour` (heute nur Gewicht + Manhattan).
- [ ] Voller End-to-End-Test inkl. Playwright (heute: Unit + Fahrer-Integrationstests).
- [ ] Verwaiste Alt-Komponenten entfernen (`Index.tsx`, `AppSidebar.tsx`, `NavLink.tsx`, `StatCard.tsx`, `TourCard.tsx`, `DispatchSidebar.tsx`).
- [ ] GPS-Historie länger als 24 Stunden / Telematik-Fremdanbieter.
- [ ] Theme als echte Akzentfarbe im Dark-Theme **oder** Picker überall entfernen.
- [ ] Preismodell, Support-Prozess, Monitoring/Backups, Datenmigration für Bestandskunden.

---

## Bewusst schon erledigt — nicht nochmal anfassen

Fahrertour aus der DB, persistenter Stop-Abschluss, Rollen-Navigation, ehrliche Karte ohne Berlin-Demo, RLS-Härtung Fahrer, Fahrerfotos-Bucket, Geokodierung (Nominatim-Fallback), Wetter vom Depot, manueller IMAP-Abruf (`fetch-imap`), Fahrer-GPS mit Messalter.

---

## Reihenfolge-Vorschlag

1. Passwort rotieren + Leaked-Password-Protection + zwei Browserprofile dokumentieren.  
2. Domain/Host + Maps-Referrer + Google-Server-Key.  
3. Supabase-Plan gegen Pause.  
4. IMAP-Konto in Einstellungen testen und in der Kontrollzentrale Mails holen; Verkäuferordner später.  
5. Ein kompletter Dispatcher+Fahrer-Durchstich auf HTTPS.  
6. Datenschutz/AVV-Pilot.  
7. Theme-Step und demo-setup für den Kundenmandanten bereinigen.  
8. Rest (Volumen, IMAP-Cron, Ordnerimport, Playwright) nach der ersten echten Tour.
