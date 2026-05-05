# Easy Planning - Deployment & Runbook

Diese Anleitung deckt zwei Modi ab:

- **Dev lokal (schnell):** DB in Docker, Backend lokal mit Reload
- **Produktionsnah:** DB + Backend komplett via Docker Compose

**Pilot / Release-Readiness** (Startpfade, Go-/No-Go, Demo-Reset-Skript, Troubleshooting-Matrix): siehe **`docs/PILOT_READINESS.md`**.

**Schnellchecks aus dem Projektroot:**

```powershell
python scripts/smoke_check.py
python scripts/demo_reset.py
```

---

## 1) Voraussetzungen

- Docker Desktop + `docker compose`
- Python 3.11+
- Ports frei: `5432` (Postgres), `8000` (API/UI)

Optional:
- PowerShell-Skripte erlauben (`ExecutionPolicy`)

---

## 2) Umgebungsvariablen

Kopie anlegen:

```powershell
copy .env.example .env
```

Wichtige Variablen:

- `DATABASE_URL` - DB-Connection-String
- `EASYPLAN_REQUIRE_AUTH` - `0` (Dev offen) / `1` (Login erforderlich)
- `JWT_SECRET` (oder `JWT_SECRET_KEY`) - JWT Secret
- `EASYPLAN_ETA_PROVIDER` - `auto`, `osrm`, `manhattan`
- `EASYPLAN_OSRM_URL` - OSRM Basis-URL

Hinweis:
- `auto` versucht OSRM und faellt bei Fehlern auf Manhattan zurueck.

---

## 3) Dev lokal starten

### Option A: Startskript (Windows)

```powershell
./scripts/start-dev.ps1
```

Oder:

```bat
scripts\start-dev.bat
```

### Option B: Manuell

```powershell
docker compose up -d db
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4) Produktionsnah via Compose

### Option A: Startskript

```powershell
./scripts/start-prod-compose.ps1
```

### Option B: Manuell

```powershell
docker compose up -d --build db backend
```

---

## 5) Datenbank / Schema

### Neue DB

```powershell
cd backend
alembic upgrade head
```

### Bestehende DB (legacy create_all)

```powershell
cd backend
python add_missing_columns.py
alembic stamp head
```

Details: siehe `backend/MIGRATION.md`.

---

## 6) Betriebsnahe Checks (Go-Live-Check)

1. Health:
   - `GET http://127.0.0.1:8000/health` -> `{"status":"ok"}`
2. Auth-Status:
   - `GET http://127.0.0.1:8000/auth/status`
3. One-Click-Demo:
   - `POST /demo/one-click`
4. Plan-Flow:
   - `POST /companies/{id}/plan` (mit Datum)
5. Driver-View:
   - als Fahrer anmelden und `/driver/me/tour-today` pruefen
6. ETA-Provider sichtbar:
   - PlanRun Snapshot: `input_snapshot.eta_provider`, `result_snapshot.eta_provider`

### Automatisierter Smoke-Test (API)

```powershell
# Im Projektroot (Ordner mit backend/)
python scripts/smoke_check.py
# oder explizit pytest:
python -m pytest backend/tests/test_smoke.py -v
```

Deckt ab: **Demo** (`/demo/one-click`) → **Plan** → **Version-Deltas** (`/version_deltas`) → **Tour aktivieren** → **Driver-View** (`/driver/me/tour-today`).

Gesamte Backend-Testsuite: `python scripts/smoke_check.py --all-tests`.

### Demo-Daten weich zurücksetzen (ohne DB zu löschen)

```powershell
python scripts/demo_reset.py
```

Mit Login-Pflicht: `EASYPLAN_SMOKE_TOKEN=<jwt>` setzen (siehe `docs/PILOT_READINESS.md`).

---

## 7) Typische Fehlerbilder & Fixes

### API startet, aber kein Login verlangt
- `EASYPLAN_REQUIRE_AUTH=1` setzen.

### JWT-Probleme / Token ungueltig nach Neustart
- `JWT_SECRET` konsistent halten (nicht zwischen Starts wechseln).

### OSRM nicht erreichbar
- `EASYPLAN_ETA_PROVIDER=auto` lassen (Fallback aktiv).
- Optional eigenes OSRM unter `EASYPLAN_OSRM_URL` setzen.

### DB-Verbindung fehlgeschlagen
- `DATABASE_URL` pruefen.
- In Compose-Mode: Host `db` verwenden, nicht `localhost`.

### Passlib bcrypt / `ValueError` bei Passwort-Hashing (bcrypt 4.x)
- `requirements.txt` pinnt `bcrypt<4`, weil `passlib` 1.7.x mit **bcrypt 4.x** nicht zuverlaessig zusammenarbeitet.
- Nach `pip install` ggf. `pip install "bcrypt>=3.2.0,<4.0.0"` ausfuehren.

---

## 8) Stop / Cleanup

```powershell
docker compose down
```

Mit DB-Daten loeschen:

```powershell
docker compose down -v
```
