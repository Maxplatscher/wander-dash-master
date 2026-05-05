# Easy Planning – Produktüberblick

## Was ist Easy Planning?
Easy Planning ist eine Leitstellen-Software für die tägliche Tourenplanung im Nahverkehr.  
Disponenten sehen auf einen Blick, ob der Tag stabil läuft oder ob Handlungsbedarf besteht.  
Das System erstellt Planversionen, zeigt Probleme transparent und unterstützt eine schnelle Freigabe.  
Fahrer erhalten am Ende eine klare, mobile Touransicht mit Status- und Stoppsteuerung.

## Kern-Nutzenargumente
- Weniger manuelle Koordination durch strukturierte Plan- und Replan-Flows.
- Schneller Überblick über Tageslage, Unassigned und Konflikte in einem Dashboard.
- Versionenvergleich mit klaren Delta-Hinweisen für fundierte Freigabeentscheidungen.
- Bessere Reaktionszeit bei Störungen durch direkte Problem- und Aktionspfade.
- Durchgängiger Ablauf von Planung bis Fahreransicht ohne Medienbruch.
- Geeignet für Demo, Pilot und schrittweise Einführung im operativen Alltag.

## Typischer Ablauf eines Planungstags
1. Mandant und Datum wählen.
2. Planlauf starten oder neu planen.
3. Ergebnis in Tagesleitstelle, Operativer Lage und Problemlisten prüfen.
4. Versionen vergleichen und passende Version aktivieren.
5. Fahrerstatus und Stopps in der Ausführung verfolgen.
6. Bei Bedarf gezielt replanen und erneut freigeben.

## Rollen
- **Admin**: richtet Mandanten, Stammdaten und Betriebsrahmen ein, steuert Pilotbetrieb.
- **Dispatcher**: plant Touren, bewertet Versionen, aktiviert Ausführung und löst Probleme.
- **Fahrer**: sieht die eigene Tour, setzt Status und meldet Stopps erledigt/zurück.

## Demo starten
Im Dashboard stehen `One-Click-Demo`, `Szenario A · Stabiler Tag` und `Szenario B · Problemtag` bereit.  
Nach dem Start werden Mandant und Datum gesetzt, ein Planlauf ausgeführt und die Lage direkt sichtbar.  
Anschließend können Versionen, Problemlisten und die Driver-View live gezeigt werden.

## Technologie
Backend: FastAPI mit SQLAlchemy und PostgreSQL.  
Frontend: Vanilla JavaScript in einer zentralen `frontend/index.html`.  
Planung und Betriebsansicht sind über API-Endpunkte gekoppelt und rollenbasiert sichtbar.  
Fokus liegt auf robuster operativer Nutzung statt UI-Framework-Komplexität.
