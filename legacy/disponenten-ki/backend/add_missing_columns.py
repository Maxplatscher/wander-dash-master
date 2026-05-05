"""Einmal ausführen: Fügt fehlende Spalten/Tabellen hinzu, falls Schema ohne Alembic (z. B. create_all) entstand.
Saubere Demo-Seed-Daten: Nutze im Dashboard „One-Click-Demo“ oder POST /demo/one-click."""
from sqlalchemy import text
from db import engine

def run():
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE shipment ADD COLUMN IF NOT EXISTS service_date DATE NULL"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS touren_plan (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id UUID NOT NULL REFERENCES company(id),
                date DATE NOT NULL,
                version INTEGER NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT FALSE,
                plan_run_id UUID REFERENCES plan_run(id),
                total_cost INTEGER,
                description VARCHAR(200),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text(
            "ALTER TABLE tour ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES touren_plan(id)"
        ))
        # Tour-Tabelle: alle Spalten, die das Model erwartet (version, date, is_active, …)
        conn.execute(text("ALTER TABLE tour ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1"))
        conn.execute(text("ALTER TABLE tour ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE"))
        conn.execute(text("ALTER TABLE tour ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE tour ADD COLUMN IF NOT EXISTS plan_run_id UUID REFERENCES plan_run(id)"))
        conn.execute(text("ALTER TABLE tour ADD COLUMN IF NOT EXISTS total_cost INTEGER"))
        conn.execute(text("ALTER TABLE tour ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
        conn.execute(text("ALTER TABLE tour ADD COLUMN IF NOT EXISTS description VARCHAR(200)"))
        # tour_stop: optionale Spalten
        conn.execute(text("ALTER TABLE tour_stop ADD COLUMN IF NOT EXISTS departure_time INTEGER"))
        conn.execute(text("ALTER TABLE tour_stop ADD COLUMN IF NOT EXISTS segment_cost INTEGER"))
        conn.execute(
            text(
                "ALTER TABLE tour_stop ADD COLUMN IF NOT EXISTS driver_completed BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE tour_stop ADD COLUMN IF NOT EXISTS driver_completed_at TIMESTAMP WITH TIME ZONE"
            )
        )
        conn.commit()
    print("Fehlende Spalten/Tabellen angelegt oder existierten bereits (shipment, touren_plan, tour, tour_stop).")

if __name__ == "__main__":
    run()
