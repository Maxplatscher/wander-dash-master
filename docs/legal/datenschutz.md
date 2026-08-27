# Datenschutzerklärung (Entwurf)

> **Entwurf — kein anwaltlich geprüfter Rechtstext und kein AVV.** Vor echtem Kundenbetrieb von einer fachkundigen Person finalisieren.

## Verantwortliche Stelle

Die verantwortliche Stelle für die Verarbeitung im jeweiligen Mandanten ist der Disponent / die Firma, die DispoCenter nutzt. Der Softwarebetrieb (Hosting, Supabase) ist Auftragsverarbeitung — ein AVV ist **nicht** unterschrieben und hier nicht beigelegt.

## Welche Daten

- Konten: E-Mail, Rolle (Disponent, Fahrer, Admin), Zuordnung zur Firma
- Disposition: Sendungen, Adressen, Gewichte, Touren, Stop-Bestätigungen
- Integrationen: IMAP/SFTP-Zugangsdaten im Vault, keine Klartext-Secrets in der UI
- Gerät: optionale Einwilligung zu Zeit und Standort (localStorage), Fahrer-GPS-Consent in „Meine Tour“
- Es gibt **keine** Live-GPS-Speicherung und keine Historie > 24 h

## Zwecke und Rechtsgrundlagen (vorläufig)

- Vertragserfüllung / berechtigtes Interesse: Tourenplanung und Zustellung
- Einwilligung (Art. 6 Abs. 1 lit. a DSGVO): Standort auf dem Gerät, soweit der Nutzer zustimmt; Widerruf unter Einstellungen bzw. Meine Tour

## Empfänger

Supabase (EU-Projekt), optional Google Maps / Geocoding, Nominatim/OSM, Gemini für Vorschläge, Serper für Artikelrecherche. Keine Weitergabe zu Werbezwecken.

## Speicherdauer

Betriebsdaten, solange der Mandant die App nutzt. GPS-Positionen werden derzeit nicht gespeichert.

## Rechte

Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Beschwerde bei einer Aufsichtsbehörde — im Entwurf ohne Verfahrensbeschreibung.

## Kontakt

Über den Disponenten der Firma. Eine Datenschutzbeauftragten-Angabe fehlt, solange nicht bestellt.
