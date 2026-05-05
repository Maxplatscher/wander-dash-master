# Pilot- & Release-Readiness (Easy Planning)

Kurzdoku für **Demo**, **Pilot** und **Release-nahen Betrieb**. Ergänzt `DEPLOYMENT.md`.

---

## Empfohlene Startwege

| Szenario | Zweck | Vorgehen |
|----------|--------|----------|
| **Dev (schnell)** | Tägliche Entwicklung, Hot-Reload | `scripts/start-dev.ps1` oder `start-dev.bat` → DB in Docker, Backend lokal `uvicorn --reload`. `EASYPLAN_REQUIRE_AUTH=0` möglich. |
| **Demo / Pilot-Tag** | Stabile Vorführung, wiederholbar | DB + Backend laufen; `python scripts/demo_reset.py` vor Demo; im UI **One-Click-Demo** → Plan → Version aktivieren. Optional Auth mit festem Test-User. |
| **Prod-like** | Näher an Produktion | `docker compose up -d --build db backend`, konsistente `.env`, `EASYPLAN_REQUIRE_AUTH=1`, starkes `JWT_SECRET`, ETA/OSRM wie in Produktion. |

**Frontend:** gleiche `index.html` – API-Base ist die Origin des Backends (relativ `/…`).

---

## Automatisierter Smoke-Check

```powershell
# Projektroot
python scripts/smoke_check.py
```

- Nutzt bei vorhandenem `backend/.venv` dessen Python, sonst `sys.executable`.
- Gesamte Backend-Testsuite: `python scripts/smoke_check.py --all-tests`

Siehe auch: `python -m pytest backend/tests/test_smoke.py -v` in `DEPLOYMENT.md`.

---

## Demo-Reset / Seed-Reset

### Weich (empfohlen vor einer Demo)

Legt bzw. aktualisiert den Mandanten **„Easy Planning Demo“** und die Demo-Sendungen (wie im UI „One-Click-Demo“):

```powershell
# Ohne Auth (Dev)
python scripts/demo_reset.py

# Mit Auth
$env:EASYPLAN_SMOKE_TOKEN="…jwt…"
python scripts/demo_reset.py
```

Optional: `EASYPLAN_BASE_URL=https://api.example.com`

### Hart (komplette DB leeren)

Nur wenn wirklich nötig (alle Mandanten weg):

```powershell
docker compose down -v
docker compose up -d db
# Schema wie in DEPLOYMENT.md (Alembic / add_missing_columns)
```

---

## Go-/No-Go-Checkliste (Pilot)

**Go**, wenn alle Punkte erfüllt (oder dokumentierte Ausnahme):

- [ ] `GET /health` → `ok`
- [ ] `GET /auth/status` passt zur erwarteten Auth-Konfiguration
- [ ] `python scripts/smoke_check.py` **exit 0** (oder manuell: Demo → Plan → Version → Fahrer)
- [ ] Karte lädt (Keys/MapId in ⚙ falls Google; Route/ETA nach Plan sichtbar)
- [ ] Eine **aktive Version** für heute wählbar; KPIs plausibel
- [ ] (Wenn Auth) Dispatcher- und Fahrer-Login getestet
- [ ] Bekannte Risiken notiert (z. B. externes OSRM, Netzwerk)

**No-Go** bei: DB nicht erreichbar, Smoke rot, 401/403 auf allen Kernpfaden ohne erklärbare Ursache.

---

## Troubleshooting-Matrix (Kurz)

| Symptom | Wahrscheinliche Ursache | Maßnahme |
|---------|-------------------------|----------|
| 500 beim Login / User anlegen | `bcrypt` 4.x + `passlib` | `pip install "bcrypt>=3.2.0,<4.0.0"` (siehe `requirements.txt`) |
| 401 überall | `EASYPLAN_REQUIRE_AUTH=1`, kein Token | Anmelden oder Test-Token setzen |
| Plan 400 „vehicle/shipment“ | Keine Fahrzeuge/Sendungen am Datum | Demo-Reset, Datum prüfen |
| OSRM langsam / Fehler | Externes OSRM down | `EASYPLAN_ETA_PROVIDER=auto` oder Manhattan |
| Leere Karte | API-Key / Map-ID | ⚙ Einstellungen |
| Fahrer: „Kein Einsatz“ | Keine aktive Tour | Version im Dashboard aktivieren |
| Smoke schlägt fehl | DB aus, falscher `DATABASE_URL` | Docker DB, `.env` prüfen |

Ausführlicher: `DEPLOYMENT.md` §7.

---

## Versions-Deltas („wesentliche Änderungen“)

`GET /companies/{id}/version_deltas?date=…` vergleicht **jede Version mit der unmittelbar älteren** (V4 ggü. V3).

- **Wesentlich (Kosten):** Differenz der Gesamtkosten ≥ `EASYPLAN_DELTA_COST_THRESHOLD` (Standard **1**).
- **Wesentlich (ETA-Spanne):** Differenz der Spanne (max−min Ankunftszeit aller Stopps) in Minuten ≥ `EASYPLAN_DELTA_ETA_THRESHOLD` (Standard **5**).
- **Immer angezeigt (strukturell):** geänderte Fahrzeugzuordnung, geänderte Stop-Reihenfolge (ohne Schwellen).
- **Unassigned:** jede Änderung der Anzahl (Vergleich nur wenn beide Seiten aus PlanRun-Snapshot lesbar).

**Fehlende Daten:** `quality_notes` erklärt, wenn Kosten, Unassigned oder ETA nicht verglichen werden konnten. **Keine ältere Version:** Hinweis bei der ältesten Version des Tages.

**Performance:** optional `EASYPLAN_DELTA_CACHE_TTL` (Sekunden) – kurzes Caching der JSON-Antwort pro Mandant/Datum.

---

## Fahrer: Fortschritt & Status (API)

- `GET /driver/me/tour-today` – liefert u. a. `progress_completed`, `progress_total`, `next_stop` (erster offener Kundenstopp), `driver_status`, pro Stopp `tour_stop_id`, `completed`, `completed_at`.
- `POST /driver/me/tour-stops/{id}/complete` – Kundenstopp als erledigt markieren (kein Depot).
- `POST /driver/me/tour-stops/{id}/uncomplete` – Erledigt zurücknehmen.
- `PATCH /driver/me` – Body `{"status":"…"}` (z. B. `available`, `on_tour`, `pause`) für Anzeige/Einsatzlogik.

Nach Schema-Update: `python add_missing_columns.py` im Ordner `backend` (Spalten `driver_completed` an `tour_stop`).

---

## Nächste sinnvolle Schritte (Backlog)

- Driver: GPS / automatischer Fortschritt (optional)
- Versionen: Schwellenwerte „wesentlich“ dokumentieren / tunen
- Pilot-Paket: feste Szenarien, Screenshots, Kurztext „Was ist das Produkt?“
