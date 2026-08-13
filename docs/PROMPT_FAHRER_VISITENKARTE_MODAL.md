# Feature-Prompt für Cursor: Fahrer-Visitenkarte als Modal (Onboarding Schritt 2)

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter). `docs/CLAUDE_PROJECT_PROMPT.md` gilt weiterhin als Basis. Betrifft den bereits umgesetzten Onboarding-Wizard (`docs/PROMPT_DC_ONBOARDING_WIZARD.md`), speziell Schritt 2.

## Ist-Zustand

`src/components/setup/steps/StepFleet.tsx` zeigt Fahrer aktuell als einfache Inline-Zeile mit zwei Feldern (Name, Telefon) plus „+ Fahrer hinzufügen" / Papierkorb zum Entfernen. Gespeichert wird beim Klick auf „Speichern & Weiter" per Bulk-Insert in `public.driver` (Spalten aktuell: `id, company_id, name, phone, status, shift_start, shift_end`).

## Auftrag

Beim Hinzufügen bzw. Bearbeiten eines Fahrers soll sich statt der Inline-Zeile ein **Modal („Visitenkarte")** öffnen mit folgenden Feldern:

1. Vor- und Nachname
2. Telefon (bestehendes Feld, bleibt zusätzlich erhalten — wird für Anrufe/Live-Map an anderer Stelle im Code bereits genutzt, siehe `DriverDetailDialog.tsx`)
3. Personalnummer
4. Geburtsdatum
5. Bild hinzufügen (Foto-Upload)
6. Festes Fahrzeug zuweisen (Dropdown — Auswahl aus den in Schritt 2 bereits erfassten Fahrzeugen bzw. bestehenden `vehicle`-Einträgen der Company)
7. Sonstige Hinweise (Freitext)

Die Fahrerliste in Schritt 2 zeigt danach kompakte Karten (Avatar/Initialen oder Foto, Name, Personalnummer) mit einem Bearbeiten-Icon, das das Modal mit den vorhandenen Werten erneut öffnet. „+ Fahrer hinzufügen" öffnet das Modal leer.

## DB-Migration nötig

`public.driver` fehlen aktuell folgende Spalten — bitte per Migration ergänzen (Muster: `IF NOT EXISTS`, siehe bisherige Migrationen im Repo):

```sql
ALTER TABLE public.driver
  ADD COLUMN IF NOT EXISTS personnel_number TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES public.vehicle(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;
```

Bestehende RLS-Policies auf `driver` (`Users can manage own drivers`, `Users can view own drivers`, beide `company_id = get_user_company_id()`) decken die neuen Spalten automatisch mit ab — keine Policy-Änderung nötig.

## Storage für Fahrer-Fotos

Aktuell existiert **kein** Supabase-Storage-Bucket im Projekt. Für den Foto-Upload:

1. Neuen Bucket anlegen, z. B. `driver-photos` (privat, nicht public — Fahrerfotos sind personenbezogene Daten).
2. RLS-Policies auf `storage.objects` für diesen Bucket analog zum bestehenden Company-Scoping: Nutzer darf nur in einen Pfad hochladen/lesen, der seiner `company_id` entspricht (z. B. Pfadkonvention `<company_id>/<driver_id oder uuid>.jpg`), Vergleich über `get_user_company_id()`.
3. Nach Upload die zurückgegebene Storage-URL (signed URL oder Pfad + `createSignedUrl`, da Bucket privat) in `driver.photo_url` speichern.

Vor dem Anlegen des Buckets und der Storage-Policies bitte kurz Rückmeldung geben, da das ein neuer Infrastruktur-Baustein ist (bisher keine Bilder im Projekt).

## UI-Anforderungen

- Modal im bestehenden Glass-Design (`.glass-card`, siehe `CLAUDE_PROJECT_PROMPT.md` Abschnitt 6), passend zum Rest des Wizards.
- Bild-Upload mit Vorschau (Kreis-Avatar), Platzhalter mit Initialen wenn kein Bild vorhanden.
- Geburtsdatum als Date-Picker oder einfaches Date-Input, keine Pflichtfelder außer Name — alle anderen Felder optional (konsistent mit „Optional — kann übersprungen werden" aus dem bestehenden Schritt-2-Text).
- Speichern im Modal aktualisiert nur den lokalen Draft-State (analog zu `FleetDriverDraft`), der eigentliche DB-Write bleibt beim „Speichern & Weiter"-Klick wie bisher — Modal soll kein voreiliges Einzel-Insert auslösen.
- `FleetDriverDraft`-Typ in `src/lib/onboarding.ts` um die neuen Felder erweitern (`personnelNumber`, `birthDate`, `photoUrl`, `assignedVehicleKey`, `notes`).

## Arbeitsweise

Erst Migration + Typ-Erweiterung, kurze Rückmeldung. Dann Modal-Komponente bauen (z. B. `src/components/setup/DriverCardModal.tsx`), kurze Rückmeldung. Dann `StepFleet.tsx` auf Karten-Darstellung + Modal umstellen, inkl. Speicherlogik mit den neuen Feldern. Storage-Bucket erst nach expliziter Bestätigung anlegen.
