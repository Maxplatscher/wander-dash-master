# Prompt für Cursor: Mittwoch — Dispatcher-Pfad komplett

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter), Supabase-Projekt `sxqbmxqnwtrgibfryvqf`, Branch `feat/samstag-fahrerbetrieb`.

## Zuerst: gestrigen Arbeitsstand sichern

Lokal liegt unfertiger, **ungecommiteter** Code vom Einstellungen-Redesign (`docs/PROMPT_EINSTELLUNGEN_DESIGN_UEBERNEHMEN.md`):

- Geändert: `IntegrationenSektion.tsx`, `useIntegrations.ts`, `index.css`, `types.ts`, `imap-mail.ts` (+ Test), `main.tsx`, `Einstellungen.tsx`, `types/integrations.ts`, `fetch-imap`, `ai-resolve`, `upsert-integration`.
- Neu: `DesignSektion.tsx`, `KiChatSektion.tsx`, `KiHinweiseSektion.tsx`, `LieferscheinOrdnerSektion.tsx`, `ai-hint-rephrase.ts` (+ Test), `appearance.ts` (+ Test), `folder-source.ts` (+ Test), `ki-chat.ts` (+ Test), Migration `20260826180000_shipment_integration_id.sql`.

Das sieht nach Teil 1 + Teil 2 + Teil 3/Schritt 1 aus dem gestrigen Prompt aus (bewusst **ohne** `ai_hint`-Tabelle — die sollte laut Vorgabe erst nach Rückmeldung kommen, und tatsächlich taucht `ai_hint` nirgends im Diff auf, das passt).

**Bevor irgendwas Neues angefasst wird:**

1. Einstellungen-Seite einmal durchklicken: Design-Sektion (Akzentfarbe/Modus/Dichte), Lieferschein-Ordner-Karten, „Hinweise an die KI"-Chat (lokaler State, kein Persistenz-Anspruch heute).
2. `npm run test` bzw. die betroffenen Unit-Tests laufen lassen (`imap-mail.test.ts`, `appearance.test.ts`, `folder-source.test.ts`, `ki-chat.test.ts`, `ai-hint-rephrase.test.ts`).
3. Migration `20260826180000_shipment_integration_id.sql` gegen das Projekt deployen, falls noch nicht geschehen (`shipment.integration_id` sollte danach existieren).
4. Wenn alles grün ist: **committen und pushen** (mehrere kleine, thematisch sortierte Commits statt einem Riesen-Commit — z. B. „Design-Sektion", „Lieferschein-Ordner-Karten", „Hinweise an die KI (lokal)"), damit der Fortschritt nicht wieder nur lokal auf dieser Maschine liegt.
5. Falls dabei etwas kaputt ist: fixen, bevor es weitergeht — nicht mit kaputtem Stand in den heutigen Durchstich starten.

Danach kurz melden, dann weiter mit dem eigentlichen Mittwoch-Auftrag.

## Mittwoch-Auftrag: kompletter Dispatcher-Pfad, einmal echt durchgeklickt

Aus `docs/CHECKLISTE_TESTKUNDE.md`, offener Punkt unter „Produkt, das der Kunde am ersten Tag braucht": **„Dispatcher-Pfad einmal echt durchspielen"** — bisher als `- [ ]` markiert, heute abhaken.

Kompletten Durchstich auf `https://dispocenter.pages.dev` (oder lokal, wenn das schneller iteriert — aber am Ende einmal auf der echten Pages-URL bestätigen) einmal komplett durchklicken, in dieser Reihenfolge:

1. **Mandant/Onboarding:** Registrierung oder bestehenden Mandanten nutzen → kompletten Onboarding-Wizard durchklicken.
2. **Depot mit Koordinaten** anlegen (ohne `lat`/`lng` bleibt später das Wetter-Widget leer — bewusst so, nicht als Bug werten, aber sicherstellen, dass beim Depot-Anlegen die Koordinaten tatsächlich gesetzt werden können und ankommen).
3. **Sendung mit echter Adresse** anlegen (manuell oder über den IMAP-Abruf aus der Kontrollzentrale, je nachdem was gerade eher geht).
4. **Geokodieren** auslösen, prüfen dass `provider = google` kommt (Server-Key ist seit gestern gesetzt).
5. **Planung starten** (`plan-tour`) — Tour muss entstehen.
6. **Fahrer sieht Tour:** im zweiten Browserprofil (Fahrer-Login, siehe `docs/PILOT_BROWSERPROFILE.md`) unter „Meine Tour" prüfen, dass die gerade geplante Tour ankommt, nicht Demo-Daten.
7. **Stop abschließen** als Fahrer.
8. **Startseite (Dispatcher-Seite) zeigt Fortschritt** — abgeschlossener Stop sichtbar, GPS-Badge mit Alter falls Fahrer Standort geteilt hat (kein „Live"-Anspruch, siehe bereits erledigte Punkte in der Checkliste).

**Alle dabei gefundenen Bugs sofort fixen, nicht sammeln.** Kleine Commits währenddessen — nach jedem gefixten Klemmpunkt ein Commit, damit im Zweifel einzeln zurückgerollt werden kann.

## Bekannte Randbedingungen, die den Durchstich beeinflussen können

- Google-Server-Key ist gesetzt, `geocode-shipments` sollte `provider = google` liefern — falls stattdessen Nominatim greift, das nicht stillschweigend hinnehmen, das wäre ein Regressions-Bug.
- Supabase-Organisation ist **Free-Tier** — falls das Projekt zwischenzeitlich pausiert (Inaktivität), kurz Bescheid geben statt lange zu debuggen, das ist kein Code-Bug.
- Referrer des Frontend-Maps-Keys ist auf `localhost:8080`, `127.0.0.1:8080` und `https://dispocenter.pages.dev/*` beschränkt — bei Depot-Adresseingabe mit Places-Autocomplete auf einem anderen Host (z. B. lokaler Dev-Server auf einem anderen Port) bricht die Autocomplete ab. Kein Datenbankfehler, sondern erwartet.
- `demo-setup` und der `research_source`/generische Integrationstyp-Editor unter „System-Integrationen" bewusst unangetastet lassen, das ist nicht Teil des heutigen Durchstichs.

## Abnahme

Ein Dispatcher kann von Null (neue Sendung) bis Tourabschluss alles ohne Klemmpunkt durchklicken — auf der echten Pages-URL einmal bestätigt, nicht nur lokal. Danach den Checklisten-Punkt in `docs/CHECKLISTE_TESTKUNDE.md` von `- [ ]` auf `- [x]` setzen und kurz notieren, was ggf. unterwegs gefixt wurde.

## Arbeitsweise

Wie bisher: nach jedem größeren Block (Sicherung von gestern, dann jeder Schritt im Durchstich) kurz meldem, nicht alles in einem Rutsch durchziehen. Gefundene Bugs sofort fixen statt in eine Liste zu schreiben.
