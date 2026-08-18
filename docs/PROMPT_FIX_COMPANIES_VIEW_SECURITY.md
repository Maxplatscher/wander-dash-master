# Prompt für Cursor: Sicherheitslücke `public.companies` schließen

> Diesen Block zu Beginn eines Cursor-Chats einfügen. Bezieht sich auf `wander-dash-master` (DispoCenter), Supabase-Projekt `sxqbmxqnwtrgibfryvqf`.

## Befund (verifiziert über Supabase-Security-Advisor + direkte SQL-Prüfung)

Es existiert eine View `public.companies` (Plural — Altlast, nicht zu verwechseln mit der eigentlichen Tabelle `public.company`), definiert als:

```sql
SELECT id, name FROM company;
```

Herkunft: `supabase/sql/000_full_base_schema.sql`, Zeile 16–17, dort explizit als „Optionaler Alias, falls companies verwendet wird" kommentiert. Im restlichen Code (`src/`, `supabase/functions/`) wird `companies` **nirgends** referenziert — toter Code.

**Das Problem:** Die View ist mit `SECURITY DEFINER` angelegt, umgeht dadurch die RLS-Policy von `company` (die eigentlich nur die eigene Company zeigt), und zusätzlich hat die Rolle `anon` — also **jeder unangemeldete Zugriff** über `/rest/v1/companies` — volle `SELECT`, `INSERT`, `UPDATE`, `DELETE`-Rechte darauf. Da es sich um eine einfache Ein-Tabellen-View ohne Trigger handelt, ist sie automatisch updatable — Schreibzugriffe würden also tatsächlich durchgehen. Das heißt aktuell kann jede Person ohne Login alle Firmennamen aller Mandanten auslesen und potenziell verändern/löschen.

## Auftrag

1. Migration schreiben, die die View entfernt (unbenutzt, kein Ersatz nötig):
   ```sql
   DROP VIEW IF EXISTS public.companies;
   ```
2. `supabase/sql/000_full_base_schema.sql` anpassen: den Abschnitt, der `public.companies` als „optionalen Alias" anlegt (Zeile ~16–17), entfernen oder zumindest den Kommentar korrigieren, damit die View bei einem künftigen Neuaufsetzen der Datenbank nicht erneut mit denselben offenen Rechten entsteht.
3. Nach dem Deploy der Migration: `get_advisors` (Security) erneut prüfen — der `security_definer_view`-Fehler für `public.companies` sollte verschwunden sein.

## Arbeitsweise

Einzelner, in sich abgeschlossener Fix — keine Rücksprache nötig, da die View nachweislich unbenutzt ist. Kurze Rückmeldung nach Migration + Schema-Datei-Anpassung.
