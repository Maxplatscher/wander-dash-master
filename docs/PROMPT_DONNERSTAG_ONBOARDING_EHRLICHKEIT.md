# Prompt für Cursor: Donnerstag — Onboarding-Ehrlichkeit

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter), Supabase-Projekt `sxqbmxqnwtrgibfryvqf`, Branch `feat/samstag-fahrerbetrieb`. Wird heute (Mittwoch) vorgezogen — Mittwochs-Auftrag ist bereits durch und gepusht (`3417439`).

Ziel laut Wochenplan: „Onboarding verspricht nichts, was die App nicht kann." Fünf Punkte, alle vorab im Code verifiziert (nicht nur aus der Checkliste abgeschrieben) — Fundstellen und Ist-Zustand stehen jeweils dabei.

## 1. `onboarding_completed_at`: von pro-User auf pro-Firma umstellen

Ist-Zustand: Spalte liegt auf `public.users` (`supabase/sql/000_full_base_schema.sql:142`, Migration `20260811193000_users_onboarding_completed_at.sql`). Die Wizard-Weiche (`src/lib/onboarding-redirect.ts`, `decideOnboardingTarget`) und der Route-Guard (`src/components/setup/OnboardingRoute.tsx`) fragen `users.onboarding_completed_at` ab. Konkreter Fehler: ein **zweiter** Dispatcher/Admin, der einer bereits fertig eingerichteten Firma beitritt, landet trotzdem im Setup-Wizard, weil sein eigener User-Datensatz das Flag noch nicht hat.

Auftrag:
- Migration: `onboarding_completed_at` auf `public.company` ergänzen (Spalte behalten oder Werte migrieren — je nachdem, ob `users.onboarding_completed_at` noch anderswo gebraucht wird, kurz prüfen).
- `OnboardingRoute.tsx` und `onboarding-redirect.ts` auf `company.onboarding_completed_at` umstellen (Join über `users.company_id`).
- Der Wizard selbst muss beim Abschluss weiterhin `users.id` kennen (für Rollen etc.), aber das Abschluss-Flag gehört auf die Firma.

## 2. Onboarding-Schritt „Design" (`StepTheme`) — entfernen, nicht anbinden

Ist-Zustand ist inzwischen schlimmer als in der Checkliste vermerkt: Seit den heutigen Commits gibt es **zwei parallele, sich überschreibende Theme-Systeme**, die auf dieselben CSS-Variablen schreiben:

- Alt: `src/lib/theme-presets.ts` (`localStorage`-Key `dispatch-theme`, 6 Presets), nur genutzt von `StepTheme.tsx` im Onboarding-Wizard.
- Neu, echt verdrahtet: `src/lib/appearance.ts` (`localStorage`-Key `dispatch-appearance`), genutzt von `DesignSektion.tsx` in den Einstellungen — das ist der heute gebaute, tatsächlich funktionierende Teil.

Beide setzen `--primary`, `--ring`, `--accent`, `--sidebar-primary`, `--sidebar-ring` per `root.style.setProperty`. `main.tsx` ruft beim Boot `applySavedAppearance()` (liest nur `dispatch-appearance`) — dadurch wird jede Wahl aus `StepTheme` beim nächsten Laden stillschweigend wieder überschrieben. `--sidebar-background`/`--sidebar-accent`/`--sidebar-border`/`--accent-foreground`, die nur `theme-presets.ts` setzt, bleiben dagegen unangetastet und können mit dem `appearance.ts`-Akzent zusammenstoßen.

Auftrag: **`StepTheme` aus dem Wizard entfernen**, nicht an `appearance.ts` anbinden (würde nur denselben Konflikt anders drehen). Vorher kurz `grep -r "theme-presets"` und `grep -r "StepTheme"` laufen lassen, um sicherzugehen, dass nichts anderes davon abhängt, dann `StepTheme.tsx` und `theme-presets.ts` entfernen, den Wizard-Schrittindex in `Setup.tsx` anpassen. Die Design-Sektion in den Einstellungen deckt die Funktion bereits vollständig und korrekt ab — im Wizard reicht ggf. ein Satz wie „Design/Akzentfarbe später in den Einstellungen anpassbar", falls an der Stelle noch ein Hinweis sinnvoll ist.

## 3. `demo-setup` für Kundenmandanten verstecken

Ist-Zustand ist ebenfalls ein Stück ernster als „nur ein Button verstecken": Der Button `"Demo-Szenario laden · demo-setup"` in `Kontrollzentrale.tsx` (Zeile ~176 Invoke, ~573–586 Button) ist für **jeden** eingeloggten Dispatcher sichtbar, ohne jede Bedingung. Die Edge Function `demo-setup` selbst prüft nicht, zu welcher Firma der Aufrufer gehört — sie sucht/erstellt eine Firma namens `Demo A`/`Demo B`, löscht deren Fahrzeuge/Fahrer und legt Demo-Daten neu an. Für einen echten Kunden würde ein Klick also (verwirrenderweise) eine fremde „Demo A"/„Demo B"-Firma anfassen, nicht die eigenen Daten — aber der Button hat im Kundenmandanten schlicht nichts verloren.

Auftrag: Button in `Kontrollzentrale.tsx` hinter eine Bedingung stellen (z. B. Firmenname/Flag „ist interner Demo-/Test-Mandant" oder ein Env-Flag `VITE_ENABLE_DEMO_SETUP`), sodass er für Kundenmandanten gar nicht gerendert wird. Zusätzlich, wenn Zeit bleibt: die Edge Function serverseitig genauso absichern (nicht nur UI-Verstecken), damit ein direkter Funktionsaufruf durch einen Kundenmandanten ebenfalls abgelehnt wird.

## 4. Fahrer-Consent: echten DSGVO-Text sichtbar machen statt nur im Onboarding zu behaupten

Ist-Zustand: Der einzige echte DSGVO-Consent-Text im Code (`src/components/setup/ConsentDialog.tsx`, u. a. *„Die Verarbeitung erfolgt auf Grundlage Ihrer Einwilligung gemäß DSGVO Art. 6 Abs. 1 lit. a. Sie können die Einwilligung jederzeit in den Einstellungen widerrufen. Ohne Standort bleibt DispoCenter nutzbar (manuelle Depot-/Adresseingabe)."*) ist **totes UI** — nur erreichbar über `/setup-consent`, was in `App.tsx` sofort auf `/setup` zurückleitet. Kein anderer Ort im Code importiert `ConsentDialog`.

Die tatsächliche Fahreransicht „Meine Tour" (`DriverTourView.tsx`) zeigt beim „Standort teilen"-Button nur eine technische Statuszeile („GPS aus — Disposition sieht nur Stop-Lagen, keine Live-Position."), **keinerlei** Einwilligungstext. Der Onboarding-Schritt `StepPermissions.tsx` fragt zwar auch einen „Standort"-Toggle ab, aber das ist der Standort des Admins/Dispatchers beim Setup selbst (Browser-Geolocation für Depot-Distanzberechnung) — hat nichts mit der Fahrer-GPS-Freigabe zu tun. Es wird also aktuell nirgends im Onboarding etwas über Fahrer-Standort-Consent versprochen, aber es fehlt auch der reale Consent-Text an der Stelle, wo er hingehört.

Auftrag: den vorhandenen DSGVO-Text aus `ConsentDialog.tsx` (oder eine daraus abgeleitete Kurzfassung) direkt neben/unter den „Standort teilen"-Button in `DriverTourView.tsx` einblenden — mindestens beim ersten Antippen (z. B. kurzer Hinweistext oder ein einmaliges Dialog-Popup, das sich merkt, dass es gezeigt wurde). Kein kompletter neuer Consent-Flow nötig, nur der bereits vorhandene, korrekte Text muss an der richtigen Stelle sichtbar werden statt nirgends aufzutauchen.

## 5. Lieferschein-Ordner-Text im Wizard — kein Overpromising gefunden, trotzdem kurz klären

Ist-Zustand: Der Wizard hat keinen eigenen Schritt zum Verbinden eines Lieferschein-Ordners. Der einzige Treffer ist ein Berechtigungs-Toggle in `StepPermissions.tsx` („Lieferschein-Ordner" / „KI darf hochgeladene Lieferscheine automatisch auslesen.") — das bezieht sich auf manuell hochgeladene Dokumente, nicht auf IMAP/SFTP/Netzwerkordner. Verspricht also nichts Falsches, ist aber vom Namen her leicht verwechselbar mit dem heute gebauten `LieferscheinOrdnerSektion.tsx` in den Einstellungen (welches selbst schon ehrlich zwischen IMAP „funktioniert", SFTP „Konfiguration liegt, keine Daten" und UNC-Ordner „manuell/extern gepflegt" unterscheidet, siehe `src/lib/folder-source.ts`).

Auftrag: kein Pflicht-Fix, da nichts überpromised wird — nur die Beschriftung in `StepPermissions.tsx` einmal gegenlesen und ggf. präzisieren (z. B. „Lieferschein-Erkennung" statt „Lieferschein-Ordner"), damit Name und tatsächliche echte Ordner-Funktion in den Einstellungen nicht verwechselt werden. Niedrige Priorität, nach den ersten vier Punkten.

## Abnahme

Onboarding verspricht nichts, was die App nicht kann: zweiter Dispatcher landet nicht mehr unnötig im Wizard, kein totes/kollidierendes Theme-Feature mehr im Wizard, `demo-setup` taucht in Kundenmandanten nicht mehr auf, Fahrer sehen den echten Consent-Text statt gar keinen.

## Arbeitsweise

Reihenfolge wie oben nummeriert, nach jedem Punkt kurz testen und melden. Punkt 2 (Theme-Konflikt) zuerst grep-prüfen, bevor Dateien gelöscht werden. Kleine Commits pro Punkt.
