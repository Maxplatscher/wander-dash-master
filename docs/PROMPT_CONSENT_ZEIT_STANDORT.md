# Feature-Prompt für Cursor: Datenschutz-Consent für Zeit/Datum & Standort

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter). Kontext: `docs/CLAUDE_PROJECT_PROMPT.md` gilt weiterhin als Basis (Tech-Stack, Architektur, Arbeitsweise).

## Auftrag

DispoCenter greift künftig auf **Zeit/Datum** und **Standort** des Geräts zu, auf dem das DC läuft (z. B. für korrekte Zeitstempel in der Disposition und für standortbasierte Depot-/Distanzberechnung). Da es sich um personenbezogene, zugriffspflichtige Daten handelt, muss **vor** der ersten Nutzung ein expliziter Consent-Screen die Erlaubnis des Nutzers einholen — DSGVO-konform (Art. 6 Abs. 1 lit. a: Einwilligung).

Baue einen einmaligen Einrichtungsschritt, der beim **ersten Einrichten des DC auf einem Gerät** erscheint, bevor das Dashboard genutzt werden kann.

## Anforderungen

1. **Neue Komponente** `src/components/setup/ConsentDialog.tsx` (Glass-Design, `.glass-card`, passend zum bestehenden Design-System — siehe Abschnitt 6 in `CLAUDE_PROJECT_PROMPT.md`).
2. **Inhalt des Dialogs:**
   - Zweck klar benennen: Zeit/Datum für korrekte Zeitstempel in Touren/Sendungen, Standort für Distanzberechnung (`assign-depot`) und Kartenanzeige.
   - Rechtsgrundlage nennen (Einwilligung nach DSGVO Art. 6 Abs. 1 lit. a).
   - Hinweis auf Widerrufbarkeit (z. B. über Einstellungen jederzeit widerrufbar).
   - Zwei getrennte Zustimmungen, da technisch unterschiedlich: „Zeit/Datum" (rein informativ, keine Browser-Permission nötig) und „Standort" (löst echten Browser-Permission-Prompt aus).
3. **Buttons:** „Erlauben" / „Ablehnen" — pro Berechtigung einzeln steuerbar, kein Alles-oder-nichts-Zwang (Kopplungsverbot DSGVO).
4. **Standort-Zugriff technisch:** Bei Klick auf „Erlauben" (Standort) `navigator.geolocation.getCurrentPosition()` aufrufen, um den nativen Browser-Permission-Dialog auszulösen. Fehler-/Ablehnungsfall (`PERMISSION_DENIED`) sauber abfangen und dem Nutzer anzeigen.
5. **Fallback ohne Standort:** Wird Standort abgelehnt, muss die App trotzdem nutzbar bleiben (z. B. manuelle Depot-/Adresseingabe statt automatischer Standorterkennung). Kernfunktionalität darf nicht blockiert werden.
6. **Persistenz des Consent-Status:** Pro Gerät/Browser via `localStorage` speichern (Key z. B. `dc_consent_v1`: `{ time: boolean, location: boolean, decidedAt: string }`), da die Anforderung „pro jeweiligem PC" lautet, nicht global pro Account. Kein neues DB-Schema nötig, außer der Nutzer möchte den Consent zusätzlich pro Nutzer-Account in der `users`-Tabelle protokollieren (dann Rücksprache halten, bevor Migration angelegt wird).
7. **Routing-Integration:** In `src/App.tsx` einen Guard ergänzen, der zusätzlich zu `ProtectedRoute` prüft, ob `localStorage`-Consent vorhanden ist. Fehlt er, auf `/setup-consent` (neue Route) weiterleiten, bevor `DispatchDashboard` gerendert wird. Bestehendes Routing (`/auth`, `/`, `*`) nicht umbauen, nur ergänzen.
8. **Nicht anfassen:** Bestehende Auth-Logik (`useAuth`, Supabase Auth), Datenmodell, Hooks, sonstiges Routing — reine Ergänzung, keine Refactorings nebenbei.
9. **Sprache/Stil:** UI-Texte auf Deutsch, kurz und klar, im Ton der übrigen App (siehe `Auth.tsx` als Referenz für Copy-Stil).

## Arbeitsweise

Erst Komponente + Consent-Logik umsetzen, kurz zusammenfassen, dann Routing-Guard ergänzen, wieder kurz zusammenfassen — nicht alles in einem Rutsch. Nach jedem Block Rückmeldung einholen, bevor der nächste beginnt.
