# Easy Planning – Vertrauen, Wirkung, Anschlussfähigkeit

Fokus der nächsten Schritte: **nicht mehr primär Kernlogik**, sondern **Vertrauen** (Rollen, Nachvollziehbarkeit), **Wirkung** (Demo-Story, Realismus) und **Anschlussfähigkeit** (ETA-Provider, klare Fachmodelle).

---

## 1. Echte Fahrzeiten / ETA-Provider

- **Stärkster fachlicher Hebel für Realismus** – macht aus reiner Distanzplanung echte Einsatzplanung.
- **Backend:** Abstraktion „Matrix-Provider“: Eingang = Koordinaten/Adressen, Ausgang = Fahrzeit-/Distanz-Matrix. Standard = aktuelles Verhalten (z. B. Manhattan), später austauschbar gegen OSRM / Here / Google.
- **Anschluss:** Einmal definierte Schnittstelle erlaubt später Wechsel des Providers ohne Umbau der Planungslogik.

---

## 2. Rollen im UI konsequent sichtbar machen

- **Nicht nur Backend-Auth**, sondern **Frontend je Rolle anders** – macht das Produkt sofort professioneller.
- **Admin:** Voller Zugriff inkl. Mandanten verwalten, Erweiterte Aktionen, Nutzerverwaltung.
- **Dispatcher:** Plan erstellen, Demo, Fahrzeuge/Fahrer/Sendungen, Touren & Versionen; kein User-Management.
- **Fahrer (Driver):** Reduzierte Ansicht: „Meine Tour“, eigene Stops, ggf. Status-Änderungen; keine Planung, keine Stammdaten.
- **Umsetzung:** Rollen-Badge im Header, `applyRoleVisibility` für alle relevanten Bereiche (Buttons, Karten, Erweiterte Aktionen), ggf. eigene „Fahrer-Cockpit“-Ansicht.

---

## 3. PlanVersion fachlich weiter schärfen

- **Unterschiede zwischen Versionen klarer** – z. B. „V2: 12 Stops, 450 €“ vs. „V1: 10 Stops, 480 €“; Kurzvergleich (Stops, Kosten, Unassigned).
- **Freigabelogik / Aktivierungslogik noch sichtbarer** – klare Labels „Aktiv“ vs. „Entwurf/Archiviert“, prominenter Button „Diese Version aktivieren“, kurzer Hinweis „Aktivierung übernimmt diese Version für die Ausführung“.
- Sehr gut für **Story und Nachvollziehbarkeit** bei Kunden und Investoren.

---

## 4. Demo-Story perfektionieren

- **Ein klarer geführter Flow:**
  1. Demo starten  
  2. Daten geladen  
  3. KI plant  
  4. Konflikte sichtbar (falls vorhanden)  
  5. Version aktivieren (falls nicht auto_activate)  
  6. Karte und KPIs aktualisieren  
- **Umsetzung:** Sichtbarer Demo-Flow (Stepper oder Statuszeile), der die Schritte nacheinander anzeigt und abhakt; Toasts/Erfolgsmeldungen statt nur Alert; optional kurzer Einleitungstext „So funktioniert die Demo“.

---

## Reihenfolge (Vorschlag)

1. **Rollen im UI** – schnell umsetzbar, sofort sichtbarer Professionalitätsgewinn.  
2. **PlanVersion schärfen** – Unterschiede + Freigabe-Logik im UI.  
3. **Demo-Story** – geführter Flow mit Schritten und klaren Meldungen.  
4. **ETA-Provider** – Backend-Abstraktion, dann erste Integration (z. B. OSRM optional).

---

## Bereits umgesetzt (Referenz)

- Stabilität: Fehlerpfade zentral (Toasts, getApiErrorText), KPI-Kacheln, Unassigned/Konflikte hervorgehoben.  
- Auth/Rollen im Backend, Dev-Modus (Auth optional).  
- PlanVersion/Touren Plan als Tabelle + API, Aktivieren einer Tour.  
- ROADMAP früher: Stabilität → Rollen → Demo-Polish → Echte Datenflüsse → PlanVersion vertiefen.
