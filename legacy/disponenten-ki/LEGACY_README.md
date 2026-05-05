# Legacy: Disponenten-KI (Easy Planning)

Dieser Ordner enthält den kompletten **bisherigen** Stand des Tourenplanungs-Tools, das in 2-3 Monaten als Python/FastAPI-Anwendung mit Vanilla-JS-Frontend entstanden ist. Es wurde am **2026-05-04** in das aktuelle wander-dash-master-Projekt (React/TypeScript/Supabase, Lovable-fähig) eingegliedert, damit Wissen, Algorithmen und Geschäftslogik nicht verloren gehen.

## Was lebt hier?

```
legacy/disponenten-ki/
├── backend/                     # FastAPI-Backend (Python)
│   ├── main.py                  # API-Entry, Endpoints
│   ├── models.py                # SQLAlchemy-Modelle
│   ├── optimizer.py             # ⭐ Tourenplanungs-Algorithmus (Kernlogik!)
│   ├── eta_provider.py          # Routing-/ETA-Provider
│   ├── auth.py                  # JWT-Auth
│   ├── version_deltas.py        # Versions-Diff-Logik
│   ├── alembic/                 # Datenbank-Migrationen (Alembic)
│   ├── migrations/              # Zusätzliche SQL-Migrationen
│   ├── routers/                 # API-Router (z.B. calendar)
│   ├── services/                # Business-Services
│   │   ├── lieferschein_parser.py        # ⭐ Email-Lieferschein-Parser
│   │   ├── lieferschein_validation.py
│   │   ├── email_poller.py / email_*.py  # ⭐ Email-Intake-Pipeline
│   ├── core/                    # Logging
│   ├── tests/                   # pytest-Suite (Auth, Calendar, Optimizer, Endpoints)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                    # Altes Vanilla-JS-Frontend (Referenz für UI-Konzepte)
│   ├── index.html               # SPA in einer Datei (~10k Zeilen)
│   └── calendar.js
├── docs/                        # ⭐ Geschäftliche Dokumentation
│   ├── PRODUCT.md               # Produkt-Vision
│   ├── DEMO_GUIDE.md            # Demo-Ablauf
│   ├── PILOT_CHECKLIST.md       # Pilot-Phase
│   ├── PILOT_READINESS.md
│   └── templates/               # Email-Vorlagen
├── scripts/                     # Smoke-Tests, Demo-Reset, Start-Skripte
├── docker-compose.yml
├── README.md / DEPLOYMENT.md / ROADMAP.md
└── .env.example, .env.pilot     # Beispiel-Configs (KEINE echten Secrets!)
```

## Was ist NICHT mitgekommen (mit Absicht)

- `.venv/` – Python-Virtual-Environment, regenerierbar via `pip install -r requirements.txt`
- `__pycache__/`, `.pytest_cache/` – Caches, regenerierbar
- `.git/` – Git-Historie der alten Code-Basis (war minimal: 1 Initial-Commit + 1 Cleanup-Branch)
- `Reißverschluss.zip` – Redundantes altes Backup vom März/April 2026 (enthielt nur eine ältere Version des `backend/`-Ordners + venv-Müll)

Ein Archiv (Teile der `.git`-Historie) liegt unter:
`C:\Users\maxpl\AppData\Roaming\Claude\local-agent-mode-sessions\.../outputs/disponenten-ki-archive/`

## Wofür ist dieser Ordner gut?

**Lese-Referenz**, kein laufender Code. Konkret:

1. **Tourenplanungs-Algorithmus** (`backend/optimizer.py`) → wenn das Live-Routing in der React-App gebaut wird, hier die fertige Logik abschauen.
2. **Lieferschein-Parser** (`backend/services/lieferschein_parser.py`) → wenn Email-Intake nach Supabase migriert wird.
3. **Datenbank-Schema** (`backend/models.py`, `backend/alembic/versions/*.py`, `backend/migrations/*.sql`) → Inspiration für Supabase-Tabellen.
4. **Geschäftslogik & Vision** (`docs/PRODUCT.md`, `ROADMAP.md`) → was die App eigentlich können soll.
5. **Tests** (`backend/tests/*.py`) → welche Test-Cases waren wichtig?

## Hinweis für Lovable / Cursor

- **Lovable** soll diesen Ordner **nicht als Build-Input verwenden**. Er ist Python-Code, kein Vite/React. Falls Lovable hier irrtümlich Build-Fehler meldet, in der Lovable-Konfiguration `legacy/` als ignored Path eintragen.
- **Cursor** darf den Ordner indexieren und Inhalte zitieren, wenn du Algorithmen oder Konzepte nach React/TypeScript portierst.

## Wenn du etwas portierst

Empfehlung: lies zuerst die Original-Datei, plane in der React/Supabase-Welt, schreibe sauberen TypeScript-Code mit Tests, **kopiere keinen Python-Code** in TypeScript-Dateien hinein.

Bei Fragen zur ursprünglichen Architektur: `legacy/disponenten-ki/README.md` und `DEPLOYMENT.md`.
