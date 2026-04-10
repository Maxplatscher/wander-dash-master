

# Festes Admin-Konto mit Auto-Login

## Was passiert

1. **Auto-Confirm aktivieren** — damit das Admin-Konto ohne E-Mail-Bestätigung funktioniert
2. **Admin-Konto in der Datenbank anlegen** — per Edge Function oder Migration ein festes Konto erstellen (E-Mail + Passwort, das du festlegst)
3. **Auto-Login im Frontend** — wenn kein User eingeloggt ist, wird automatisch mit den Admin-Credentials eingeloggt, statt die Login-Seite zu zeigen
4. **Login-Seite bleibt erhalten** — andere Nutzer (Dispatcher, Fahrer) können sich weiterhin normal anmelden

## Umsetzung

- `configure_auth` → Auto-Confirm aktivieren
- Auth-Seite (`Auth.tsx`) bekommt einen Auto-Login-Mechanismus: beim Laden wird `signInWithPassword` mit den festen Admin-Credentials aufgerufen
- Die Credentials werden als Umgebungsvariablen gespeichert (oder direkt im Code für Entwicklungszwecke)
- Das Admin-Konto wird einmalig per Edge Function `demo-setup` oder manuell angelegt

## Ich brauche von dir

- **E-Mail-Adresse** für dein Admin-Konto (z.B. `admin@dispocenter.de`)
- **Passwort** für dein Admin-Konto

Diese werden beim ersten Start automatisch registriert und eingeloggt.

