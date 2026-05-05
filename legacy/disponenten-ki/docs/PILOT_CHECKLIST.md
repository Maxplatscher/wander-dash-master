# Pilot-Checkliste – Easy Planning

Vor jedem Pilot-Einsatz durchgehen und abhaken (ca. 10 Minuten).

## Täglicher Smoke-Test

### E-Mail-Intake

- [ ] Test-E-Mail an die konfigurierte Lieferschein-Adresse senden (siehe `EMAIL_IMAP_USER` / `.env.pilot`)
- [ ] Sendung erscheint im Tab „E-Mail offen“ (unvollständig / manuell prüfen)
- [ ] Freigabe-Modal öffnet sich; Pflichtfelder und Pills plausibel
- [ ] Freigabe erfolgreich; Sendung erscheint bei Planung / „Nicht zugewiesen“ wie erwartet

### Tourenplanung

- [ ] Plan startet ohne Fehlermeldung (Toast / Konsole)
- [ ] Mindestens eine Tour wird erzeugt (Versionen-Tabelle / Karte)
- [ ] Fahrzeuge/Zuordnung nachvollziehbar
- [ ] Kalender zeigt die Tour am erwarteten **Service-Datum**

### Fahrer-UX

- [ ] Fahrer sieht „Meine Tour heute“ (oder Hinweis, wenn keine aktive Tour)
- [ ] Kundenstopp als erledigt markieren funktioniert; Liste aktualisiert sich
- [ ] Bei Netzwerkfehler erscheint eine verständliche Meldung (Toast)

### Konflikt-Handling

- [ ] KPI / Badges zeigen Konflikte bzw. Unassigned, wenn der Plan das meldet
- [ ] Anpassung (neu planen, Version aktivieren) ohne harten Browser-Reload möglich

### Allgemein

- [ ] Keine roten JS-Fehler in der Browser-Konsole bei Standard-Flows
- [ ] Keine wiederkehrenden **500**-Einträge im Server-Log
- [ ] Antwortzeiten subjektiv akzeptabel (z. B. Dashboard &lt; ca. 2 s)

### Technische Schnellprüfung

- [ ] `GET /health` liefert `status`, `db: ok`, sinnvollen `imap`-Status
- [ ] `GET /docs` erreichbar (API-Dokumentation)

---

**Abnahme**

| Datum | Name | Unterschrift |
| ----- | ---- | ------------ |
|       |      |              |
