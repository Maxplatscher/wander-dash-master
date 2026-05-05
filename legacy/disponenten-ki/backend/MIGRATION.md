# Datenbank-Migrationen (Alembic)

## Neue Umgebung (leere DB)

```bash
cd backend
# Optional: venv aktivieren
alembic upgrade head
```

Migrationen in Reihenfolge: 001 (users), 002 (shipment.service_date), 003 (touren_plan, tour.plan_version_id).

## Bestehende DB (Schema per create_all entstanden)

Fehlende Spalten/Tabellen nachziehen, ohne bestehende Daten zu löschen:

```bash
cd backend
python add_missing_columns.py
```

Anschließend Alembic-Stand setzen (damit spätere Migrationen nicht erneut ausgeführt werden):

```bash
alembic stamp head
```

## Tests mit Auth-Erzwingung

Für tests, die 401 ohne Token erwarten (z. B. `test_companies_require_auth`):

```bash
set EASYPLAN_REQUIRE_AUTH=1
pytest tests/ -v
```

## Demo-Seed-Daten

- **Im Dashboard:** Button „One-Click-Demo“ (legt Mandant „Easy Planning Demo“, 2 Fahrzeuge, 5 Sendungen an).
- **API:** `POST /demo/one-click` (mit gültigem Token oder im Dev-Modus ohne Token).
- Reproduzierbar: Jeder Klick ergänzt nur fehlende Fahrzeuge/Sendungen; Mandant wird wiederverwendet.
