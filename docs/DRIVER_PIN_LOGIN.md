# Fahrer-Login per Name + Code

Fahrer melden sich mit Vorname, Nachname und einem 5-stelligen Code an. Dispatcher
bleiben bei E-Mail/Passwort (Tab „Dispo“).

## Session

`driver-pin-login` erzeugt eine normale Supabase-Session:

1. PIN gegen `driver_login_secret.code_hash` (bcrypt) prüfen.
2. Falls schon ein `users`-Datensatz mit `driver_id` existiert (z. B. alter E-Mail-Invite),
   diesen Auth-User verwenden — **Passwort wird nicht rotiert**, damit der Dispo-Tab
   für bestehende Testfahrer weitergeht.
3. Sonst Schatten-User `pin.{driverId}@drivers.dispocenter.invalid`.
4. Session über `auth.admin.generateLink` (Magic-Link) + `verifyOtp({ token_hash })`.

RLS bleibt unverändert: `auth.uid()` → `users.driver_id` → `get_current_driver_id()`.

## Sperren

- 5 Fehlversuche pro normalisiertem Namen + IP in 15 Minuten → 15 Minuten Sperre.
- Zusätzlich max. 25 Fehlversuche pro IP in 15 Minuten (gegen Namen-Sprühen).
- Pro Fahrer: `failed_attempts` / `locked_until` in `driver_login_secret`.
- Zwei Treffer (gleicher Name **und** gleicher Code): beide sperren, kein Login
  (kein zufälliger Treffer). Auffälligkeit steht in `driver_login_attempt`.
- Fehlermeldung bei falschem Code immer: „Name oder Code falsch.“

Der Klartext-Code wird nur einmal an den Dispatcher zurückgegeben, nie gespeichert.

## Bestehende E-Mail-Fahrer

Testfahrer mit E-Mail/Passwort bleiben über den Tab **Dispo** nutzbar. PIN-Login
rotiert deren Auth-Passwort nicht. E-Mail im Fahrer-Dialog ist optional (z. B.
für Einladungen), nicht nötig für den Code-Login.

Migration und Edge Functions erst nach Rücksprache remote anwenden.
